<?php

namespace App\Console\Commands;

use App\Attachment;
use App\Conversation;
use App\Customer;
use App\Email;
use App\Events\CustomerCreatedConversation;
use App\Events\CustomerReplied;
use App\Events\UserReplied;
use App\Mail\Mail;
use App\Mailbox;
use App\Option;
use App\Subscription;
use App\Thread;
use App\User;
use Illuminate\Console\Command;
use Webklex\IMAP\Client;

class FetchEmails extends Command
{
    /**
     * Period in days for fetching emails from mailbox email.
     */
    const CHECK_PERIOD = 3;

    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'freescout:fetch-emails';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Fetch emails from mailboxes addresses';

    /**
     * Current mailbox.
     *
     * @var Mailbox
     */
    public $mailbox;

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return mixed
     */
    public function handle()
    {
        $now = time();
        Option::set('fetch_emails_last_run', $now);

        // Get active mailboxes
        $mailboxes = Mailbox::where('in_protocol', '<>', '')
            ->where('in_server', '<>', '')
            ->where('in_port', '<>', '')
            ->where('in_username', '<>', '')
            ->where('in_password', '<>', '')
            ->get();

        foreach ($mailboxes as $mailbox) {
            $this->info('['.date('Y-m-d H:i:s').'] Mailbox: '.$mailbox->name);

            $this->mailbox = $mailbox;

            try {
                $this->fetch($mailbox);
                Option::set('fetch_emails_last_successful_run', $now);
            } catch (\Exception $e) {
                $this->logError('Error: '.$e->getMessage().'; File: '.$e->getFile().' ('.$e->getLine().')').')';
            }

            // Middleware Terminate handler is not launched for commands,
            // so we need to run processing subscription events manually
            Subscription::processEvents();
        }
    }

    public function fetch($mailbox)
    {
        $client = new Client([
            'host'          => $mailbox->in_server,
            'port'          => $mailbox->in_port,
            'encryption'    => $mailbox->getInEncryptionName(),
            'validate_cert' => true,
            'username'      => $mailbox->in_username,
            'password'      => $mailbox->in_password,
            'protocol'      => $mailbox->getInProtocolName(),
        ]);

        // Connect to the Server
        $client->connect();

        // Get folder
        $folder = $client->getFolder('INBOX');

        if (!$folder) {
            throw new \Exception('Could not get mailbox folder: INBOX', 1);
        }

        // Get unseen messages for a period
        $messages = $folder->query()->unseen()->since(now()->subDays(self::CHECK_PERIOD))->leaveUnread()->get();

        if ($client->getLastError()) {
            $this->logError($client->getLastError());
        }

        $this->line('['.date('Y-m-d H:i:s').'] Fetched: '.count($messages));

        $message_index = 1;

        try {
            // We have to sort messages manually, as they can be in non-chronological order
            $messages = $this->sortMessage($messages);
            foreach ($messages as $message_id => $message) {
                $this->line('['.date('Y-m-d H:i:s').'] '.$message_index.') '.$message->getSubject());
                $message_index++;

                // Check if message already fetched
                if (Thread::where('message_id', $message_id)->first()) {
                    $this->line('['.date('Y-m-d H:i:s').'] Message with such Message-ID has been fetched before: '.$message_id);
                    $message->setFlag(['Seen']);
                    continue;
                }

                // From
                $from = $message->getReplyTo();
                if (!$from) {
                    $from = $message->getFrom();
                }
                if (!$from) {
                    $this->logError('From is empty');
                    $message->setFlag(['Seen']);
                    continue;
                } else {
                    $from = $this->formatEmailList($from);
                    $from = $from[0];
                }

                // Detect prev thread
                $is_reply = false;
                $prev_thread = null;
                $user_id = null;
                $user = null; // for user reply only
                $message_from_customer = true;
                $in_reply_to = $message->getInReplyTo();
                $references = $message->getReferences();
                $attachments = $message->getAttachments();

                // Is it a bounce message
                $is_bounce = false;
                $bounce_message = null;
                if ($message->hasAttachments()) {
                    foreach ($attachments as $attachment) {
                        if (!empty(Attachment::$types[$attachment->getType()]) && Attachment::$types[$attachment->getType()] == Attachment::TYPE_MESSAGE) {
                            if (in_array($attachment->getName(), ['RFC822', 'DELIVERY-STATUS'])) {
                                $is_bounce = true;
                                $bounce_attachment = $attachment;
                                break;
                            }
                        }
                    }
                }

                // Is it a message from Customer or User replied to the notification
                preg_match('/^'.\App\Mail\Mail::MESSAGE_ID_PREFIX_NOTIFICATION."\-(\d+)\-(\d+)\-/", $in_reply_to, $m);
                if (!$is_bounce && !empty($m[1]) && !empty($m[2])) {
                    // Reply from User to the notification
                    $prev_thread = Thread::find($m[1]);
                    $user_id = $m[2];
                    $user = User::find($user_id);
                    $message_from_customer = false;
                    $is_reply = true;

                    if (!$user) {
                        $this->logError('User not found: '.$user_id);
                        $message->setFlag(['Seen']);
                        continue;
                    }
                    $this->line('['.date('Y-m-d H:i:s').'] Message from: User');
                } elseif (($user = User::where('email', $from)->first()) && $in_reply_to && ($prev_thread = Thread::where('message_id', $in_reply_to)->first()) && $prev_thread->created_by_user_id == $user->id) {
                    // Reply from customer to his reply to the notification
                    $user_id = $user->id;
                    $message_from_customer = false;
                    $is_reply = true;
                } else {
                    // Message from Customer
                    $this->line('['.date('Y-m-d H:i:s').'] Message from: Customer');

                    $prev_message_id = '';
                    if ($in_reply_to) {
                        $prev_message_id = $in_reply_to;
                    } elseif ($references) {
                        if (!is_array($references)) {
                            $references = array_filter(preg_split('/[, <>]/', $references));
                        }
                        // Maybe we need to check all references
                        $prev_message_id = $references[0];
                    }
                    if ($prev_message_id) {
                        preg_match('/^'.\App\Mail\Mail::MESSAGE_ID_PREFIX_REPLY_TO_CUSTOMER."\-(\d+)\-/", $prev_message_id, $m);
                        if (!empty($m[1])) {
                            $prev_thread = Thread::find($m[1]);
                        }
                    }
                    if (!empty($prev_thread)) {
                        $is_reply = true;
                    }
                }
                if ($message->hasHTMLBody()) {
                    // Get body and replace :cid with images URLs
                    $body = $message->getHTMLBody(true);
                    $body = $this->separateReply($body, true, $is_reply);
                } else {
                    $body = $message->getTextBody();
                    $body = $this->separateReply($body, false, $is_reply);
                }
                if (!$body) {
                    $this->logError('Message body is empty');
                    $message->setFlag(['Seen']);
                    continue;
                }

                $subject = $message->getSubject();

                $to = $this->formatEmailList($message->getTo());
                $to = $mailbox->removeMailboxEmailsFromList($to);

                $cc = $this->formatEmailList($message->getCc());
                $cc = $mailbox->removeMailboxEmailsFromList($cc);

                $bcc = $this->formatEmailList($message->getBcc());
                $bcc = $mailbox->removeMailboxEmailsFromList($bcc);

                if ($message_from_customer) {
                    $new_thread_id = $this->saveCustomerThread($mailbox->id, $message_id, $prev_thread, $from, $to, $cc, $bcc, $subject, $body, $attachments, $message->getHeader());
                } else {
                    // Check if From is the same as user's email.
                    // If not we send an email with information to the sender.
                    if (Email::sanitizeEmail($user->email) != Email::sanitizeEmail($from)) {
                        $this->logError("From address {$from} is not the same as user {$user->id} email: ".$user->email);
                        $message->setFlag(['Seen']);
                        // todo: send email with information
                        // Unable to process your update
                        // Your email update couldn't be processed
                        // If you are trying to update a conversation, remember you must respond from the same email address that's on your account. To send your update, please try again and send from your account email address (the email you login with).
                        continue;
                    }

                    $new_thread_id = $this->saveUserThread($mailbox, $message_id, $prev_thread, $user_id, $to, $cc, $bcc, $body, $attachments, $message->getHeader());
                }

                if ($new_thread_id) {
                    $message->setFlag(['Seen']);
                    $this->line('['.date('Y-m-d H:i:s').'] Thread successfully created: '.$new_thread_id);
                } else {
                    $this->logError('Error occured processing message');
                }
            }
        } catch (\Exception $e) {
            $message->setFlag(['Seen']);

            throw $e;
        }
    }

    public function logError($message)
    {
        $this->error('['.date('Y-m-d H:i:s').'] '.$message);

        $mailbox_name = '';
        if ($this->mailbox) {
            $mailbox_name = $this->mailbox->name;
        }

        try {
            activity()
                ->withProperties([
                    'error'    => $message,
                    'mailbox'  => $mailbox_name,
                ])
                ->useLog(\App\ActivityLog::NAME_EMAILS_FETCHING)
                ->log(\App\ActivityLog::DESCRIPTION_EMAILS_FETCHING_ERROR);
        } catch (\Exception $e) {
            // Do nothing
        }
    }

    /**
     * Save email from customer as thread.
     */
    public function saveCustomerThread($mailbox_id, $message_id, $prev_thread, $from, $to, $cc, $bcc, $subject, $body, $attachments, $headers)
    {
        $cc = array_merge($cc, $to);

        // Find conversation
        $new = false;
        $conversation = null;
        $now = date('Y-m-d H:i:s');

        $customer = Customer::create($from);
        if ($prev_thread) {
            $conversation = $prev_thread->conversation;

            // If reply came from another customer: change customer, add original as CC
            if ($conversation->customer_id != $customer->id) {
                $cc[] = $conversation->customer->getMainEmail();
                $conversation->customer_id = $customer->id;
            }
        } else {
            // Create conversation
            $new = true;

            $conversation = new Conversation();
            $conversation->type = Conversation::TYPE_EMAIL;
            $conversation->state = Conversation::STATE_PUBLISHED;
            $conversation->subject = $subject;
            $conversation->setCc($cc);
            $conversation->setBcc($bcc);
            $conversation->setPreview($body);
            if (count($attachments)) {
                $conversation->has_attachments = true;
            }
            $conversation->mailbox_id = $mailbox_id;
            $conversation->customer_id = $customer->id;
            $conversation->created_by_customer_id = $customer->id;
            $conversation->source_via = Conversation::PERSON_CUSTOMER;
            $conversation->source_type = Conversation::SOURCE_TYPE_EMAIL;
        }
        // Reply from customer makes conversation active
        $conversation->status = Conversation::STATUS_ACTIVE;
        $conversation->last_reply_at = $now;
        $conversation->last_reply_from = Conversation::PERSON_CUSTOMER;
        // Set folder id
        $conversation->updateFolder();
        $conversation->save();

        // Thread
        $thread = new Thread();
        $thread->conversation_id = $conversation->id;
        $thread->user_id = $conversation->user_id;
        $thread->type = Thread::TYPE_CUSTOMER;
        $thread->status = $conversation->status;
        $thread->state = Thread::STATE_PUBLISHED;
        $thread->message_id = $message_id;
        $thread->headers = $headers;
        $thread->body = $body;
        $thread->setTo($to);
        $thread->setCc($cc);
        $thread->setBcc($bcc);
        $thread->source_via = Thread::PERSON_CUSTOMER;
        $thread->source_type = Thread::SOURCE_TYPE_EMAIL;
        $thread->customer_id = $customer->id;
        $thread->created_by_customer_id = $customer->id;
        $thread->save();

        $has_attachments = $this->saveAttachments($attachments, $thread->id);
        if ($has_attachments) {
            $thread->has_attachments = true;
            $thread->save();
        }

        if ($new) {
            event(new CustomerCreatedConversation($conversation, $thread));
        } else {
            event(new CustomerReplied($conversation, $thread));
        }

        return $thread->id;
    }

    /**
     * Save email reply from user as thread.
     */
    public function saveUserThread($mailbox, $message_id, $prev_thread, $user_id, $to, $cc, $bcc, $body, $attachments, $headers)
    {
        $cc = array_merge($cc, $to);

        $conversation = null;
        $now = date('Y-m-d H:i:s');

        $conversation = $prev_thread->conversation;
        // Determine assignee
        // mailbe we need to check mailbox->ticket_assignee here, maybe not
        if (!$conversation->user_id) {
            $conversation->user_id = $user_id;
        }

        // Reply from user makes conversation pending
        $conversation->status = Conversation::STATUS_PENDING;
        $conversation->last_reply_at = $now;
        $conversation->last_reply_from = Conversation::PERSON_USER;
        $conversation->user_updated_at = $now;
        // Set folder id
        $conversation->updateFolder();
        $conversation->save();

        // Thread
        $thread = new Thread();
        $thread->conversation_id = $conversation->id;
        $thread->user_id = $conversation->user_id;
        $thread->type = Thread::TYPE_MESSAGE;
        $thread->status = $conversation->status;
        $thread->state = Thread::STATE_PUBLISHED;
        $thread->message_id = $message_id;
        $thread->headers = $headers;
        $thread->body = $body;
        $thread->setTo($to);
        $thread->setCc($cc);
        $thread->setBcc($bcc);
        $thread->source_via = Thread::PERSON_USER;
        $thread->source_type = Thread::SOURCE_TYPE_EMAIL;
        $thread->customer_id = $conversation->customer_id;
        $thread->created_by_user_id = $user_id;
        $thread->save();

        $has_attachments = $this->saveAttachments($attachments, $thread->id);
        if ($has_attachments) {
            $thread->has_attachments = true;
            $thread->save();
        }

        event(new UserReplied($conversation, $thread));

        return $thread->id;
    }

    /**
     * Save attachments from email.
     *
     * @param array $attachments
     * @param int   $thread_id
     *
     * @return bool
     */
    public function saveAttachments($email_attachments, $thread_id)
    {
        $has_attachments = false;
        foreach ($email_attachments as $email_attachment) {
            $create_result = Attachment::create(
                $email_attachment->getName(),
                $email_attachment->getMimeType(),
                Attachment::typeNameToInt($email_attachment->getType()),
                $email_attachment->getContent(),
                '',
                false,
                $thread_id
            );
            if ($create_result) {
                $has_attachments = true;
            }
        }

        return $has_attachments;
    }

    /**
     * Separate reply in the body.
     *
     * @param string $body
     *
     * @return string
     */
    public function separateReply($body, $is_html, $is_reply)
    {
        $cmp_reply_length_desc = function ($a, $b) {
            if (mb_strlen($a) == mb_strlen($b)) {
                return 0;
            }

            return (mb_strlen($a) < mb_strlen($b)) ? -1 : 1;
        };

        if ($is_html) {
            // Extract body content from HTML
            $dom = new \DOMDocument();
            libxml_use_internal_errors(true);
            $dom->loadHTML(mb_convert_encoding($body, 'HTML-ENTITIES', 'UTF-8'));
            libxml_use_internal_errors(false);
            $bodies = $dom->getElementsByTagName('body');
            if ($bodies->length == 1) {
                $body_el = $bodies->item(0);
                $body = $dom->saveHTML($body_el);
            }
            preg_match("/<body[^>]*>(.*?)<\/body>/is", $body, $matches);
            if (count($matches)) {
                $body = $matches[1];
            }
        } else {
            $body = nl2br($body);
        }

        // This is reply, we need to separate reply text from old text
        if ($is_reply) {
            // Check all separators and choose the shortest reply
            $reply_bodies = [];
            foreach (Mail::$alternative_reply_separators as $alt_separator) {
                $parts = explode($alt_separator, $body);
                if (count($parts) > 1) {
                    $reply_bodies[] = $parts[0];
                }
            }
            if (count($reply_bodies)) {
                usort($reply_bodies, $cmp_reply_length_desc);

                return $reply_bodies[0];
            }
        }

        return $body;
    }

    /**
     * Conver email object to plain emails.
     *
     * @param array $obj_list
     *
     * @return array
     */
    public function formatEmailList($obj_list)
    {
        $plain_list = [];
        foreach ($obj_list as $item) {
            $item->mail = Email::sanitizeEmail($item->mail);
            if ($item->mail) {
                $plain_list[] = $item->mail;
            }
        }

        return $plain_list;
    }

    /**
     * We have to sort messages manually, as they can be in non-chronological order.
     *
     * @param Collection $messages
     *
     * @return Collection
     */
    public function sortMessage($messages)
    {
        $messages = $messages->sortBy(function ($message, $key) {
            return $message->getDate()->timestamp;
        });

        return $messages;
    }
}
