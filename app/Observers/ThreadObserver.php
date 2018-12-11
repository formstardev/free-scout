<?php

namespace App\Observers;

use App\Conversation;
use App\Thread;

class ThreadObserver
{
    /**
     * Thread created.
     *
     * @param Thread $thread
     */
    public function created(Thread $thread)
    {
        // Update data in conversation
        $conversation = $thread->conversation;

        $now = date('Y-m-d H:i:s');
        if (!in_array($thread->type, [Thread::TYPE_LINEITEM, Thread::TYPE_NOTE]) && $thread->state == Thread::STATE_PUBLISHED) {
            $conversation->threads_count++;
        }
        if (!in_array($thread->type, [Thread::TYPE_CUSTOMER])) {
            $conversation->user_updated_at = $now;
        }
        if (in_array($thread->type, [Thread::TYPE_CUSTOMER, Thread::TYPE_MESSAGE]) && $thread->state == Thread::STATE_PUBLISHED) {
            // $conversation->cc = $thread->cc;
            // $conversation->bcc = $thread->bcc;
            $conversation->last_reply_at = $now;
            $conversation->last_reply_from = $thread->source_via;
        }
        if ($conversation->source_via == Conversation::PERSON_CUSTOMER) {
            $conversation->read_by_user = false;
        }

        // Update preview.
        if (in_array($thread->type, [Thread::TYPE_CUSTOMER, Thread::TYPE_MESSAGE, Thread::TYPE_NOTE]) && $thread->state == Thread::STATE_PUBLISHED && ($conversation->threads_count > 1 || $thread->type == Thread::TYPE_NOTE))
        {
            $conversation->setPreview($thread->body);
        }

        $conversation->save();
    }
}
