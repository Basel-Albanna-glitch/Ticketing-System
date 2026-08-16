import { useState } from 'react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import FileInput from '../ui/FileInput'
import Textarea from '../ui/Textarea'
import AttachmentList from './AttachmentList'
import { usePostComment } from '../../hooks/useTicket'
import { useI18n } from '../../i18n/useI18n'

export default function CommentThread({ ticketId, comments, canReply = true }) {
  const { t } = useI18n()
  const [body, setBody] = useState('')
  const [files, setFiles] = useState([])
  const postComment = usePostComment(ticketId)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!body.trim()) return
    await postComment.mutateAsync({ body, attachments: files })
    setBody('')
    setFiles([])
  }

  return (
    <div className="flex flex-col gap-4">
      {comments?.length ? (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex gap-3 rounded-xl border border-gray-200/70 bg-gray-50/50 p-3 dark:border-white/10 dark:bg-white/5"
            >
              <Avatar
                name={c.author_name || c.author?.full_name}
                src={c.author?.avatar}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {c.author_name || c.author?.full_name}
                  </span>
                  <span>{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">{c.body}</p>
                {c.attachments?.length > 0 && (
                  <div className="mt-2">
                    <AttachmentList attachments={c.attachments} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-sm text-gray-400 dark:border-white/10 dark:text-gray-400">
          {t('tickets.noComments')}
        </p>
      )}

      {canReply ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-gray-100 pt-4 dark:border-white/10">
          <Textarea
            placeholder={t('tickets.writeReply')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
          <FileInput files={files} onChange={setFiles} />
          <Button type="submit" loading={postComment.isPending} className="self-start">
            {t('tickets.reply')}
          </Button>
        </form>
      ) : (
        <p className="border-t border-gray-100 pt-4 text-sm text-gray-400 dark:border-white/10 dark:text-gray-400">
          {t('tickets.onlyAssignedCanRespond')}
        </p>
      )}
    </div>
  )
}
