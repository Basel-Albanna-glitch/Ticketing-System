import { Fragment, useState } from 'react'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import Pagination from '../ui/Pagination'
import Spinner from '../ui/Spinner'
import Table from '../ui/Table'
import ImageLightbox from '../ui/ImageLightbox'
import { BadgeIcon, BoardIcon, ChevronRightIcon, PaperClipIcon, TicketIcon, UserIcon } from '../ui/icons'
import TicketTable from '../tickets/TicketTable'
import { useTickets } from '../../hooks/useTickets'
import { isImageAttachment } from '../../utils/attachments'
import { useI18n } from '../../i18n/useI18n'

function Detail({ label, value, full }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">
        {value || '—'}
      </dd>
    </div>
  )
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{children}</h2>
    </div>
  )
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Tickets attached to a single branch, loaded on demand when the branch row is expanded.
function BranchTicketsPanel({ customerId, branchId }) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const { data: tickets, isLoading } = useTickets({
    customer: customerId,
    branch: branchId,
    page,
  })

  // A first-page empty result means the branch has no tickets at all.
  if (isLoading && !tickets) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }
  if (!tickets?.results?.length) {
    return <EmptyState title={t('customers.branchNoTickets')} />
  }
  return (
    <>
      <TicketTable tickets={tickets.results} />
      <Pagination
        page={page}
        count={tickets.count}
        hasNext={!!tickets.next}
        hasPrevious={!!tickets.previous}
        onPageChange={setPage}
      />
    </>
  )
}

// Read-only body of a customer's profile: account details, attachments, licenses, branches
// (each expandable to its tickets), and the customer's own tickets. Shared by the staff-facing
// customer profile page and a customer's own "My account" page.
export default function CustomerProfileDetails({ customer, customerId }) {
  const { t } = useI18n()
  const [expandedBranch, setExpandedBranch] = useState(null)
  const [page, setPage] = useState(1)
  const [previewIndex, setPreviewIndex] = useState(null)
  const { data: tickets, isLoading: isLoadingTickets } = useTickets({ customer: customerId, page })

  // Only the image attachments are previewable, and the viewer pages through them.
  const previewImages = (customer?.attachments || []).filter(isImageAttachment)

  return (
    <>
      <Card>
        <SectionTitle icon={UserIcon}>{t('customers.details')}</SectionTitle>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label={t('customers.softwareType')} value={customer?.software_type} />
          <Detail label={t('field.phone')} value={customer?.phone} />
          <Detail label={t('customers.taxNumber')} value={customer?.tax_number} />
          <Detail label={t('field.email')} value={customer?.email} />
          <Detail label={t('field.address')} value={customer?.address} full />
        </dl>
      </Card>

      <div>
        <SectionTitle icon={PaperClipIcon}>{t('field.attachments')}</SectionTitle>
        {customer?.attachments?.length ? (
          <Card>
            <ul className="divide-y divide-gray-100 dark:divide-white/5">
              {customer.attachments.map((att) => (
                <li key={att.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  {isImageAttachment(att) && (
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(previewImages.findIndex((i) => i.id === att.id))}
                      title={att.original_filename}
                      className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-gray-200/70 transition-colors hover:border-indigo-300 dark:border-white/10 dark:hover:border-indigo-400/40"
                    >
                      <img
                        src={att.file}
                        alt={att.original_filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}
                  <a
                    href={att.file}
                    target="_blank"
                    rel="noreferrer"
                    className="me-auto truncate text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                  >
                    {att.original_filename}
                  </a>
                  <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">
                    {formatSize(att.size)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <EmptyState title={t('customers.noAttachments')} />
        )}
        {previewIndex !== null && (
          <ImageLightbox
            images={previewImages}
            index={previewIndex}
            onIndexChange={setPreviewIndex}
            onClose={() => setPreviewIndex(null)}
          />
        )}
      </div>

      <div>
        <SectionTitle icon={BadgeIcon}>{t('customers.licenses')}</SectionTitle>
        {customer?.licenses?.length ? (
          <Table columns={[t('customers.licenseName'), t('customers.startDate'), t('customers.endDate')]}>
            {customer.licenses.map((lic) => (
              <tr key={lic.id}>
                <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                  {lic.name || '—'}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{lic.start_date || '—'}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{lic.end_date || '—'}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <EmptyState title={t('customers.noLicenses')} />
        )}
      </div>

      <div>
        <SectionTitle icon={BoardIcon}>{t('customers.branches')}</SectionTitle>
        {customer?.branches?.length ? (
          <Table
            columns={[t('customers.branchName'), t('field.address'), t('customers.branchTickets'), '']}
          >
            {customer.branches.map((b) => {
              const isOpen = expandedBranch === b.id
              const count = b.ticket_count ?? 0
              return (
                <Fragment key={b.id}>
                  <tr
                    onClick={() => setExpandedBranch(isOpen ? null : b.id)}
                    className="cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">
                      <span className="flex items-center gap-2">
                        <ChevronRightIcon
                          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        />
                        {b.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{b.address || '—'}</td>
                    <td className="px-4 py-2">
                      <Badge color={count > 0 ? 'purple' : 'gray'}>{count}</Badge>
                    </td>
                    <td className="px-4 py-2 text-end">
                      <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                        {t('customers.viewBranchTickets')}
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={4} className="bg-gray-50/60 px-4 py-4 dark:bg-white/5">
                        <BranchTicketsPanel customerId={customerId} branchId={b.id} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </Table>
        ) : (
          <EmptyState title={t('customers.noBranches')} />
        )}
      </div>

      <div>
        <SectionTitle icon={TicketIcon}>{t('customers.tickets')}</SectionTitle>
        {isLoadingTickets && !tickets ? (
          <Spinner />
        ) : tickets?.results?.length ? (
          <>
            <TicketTable tickets={tickets.results} />
            <Pagination
              page={page}
              count={tickets.count}
              hasNext={!!tickets.next}
              hasPrevious={!!tickets.previous}
              onPageChange={setPage}
            />
          </>
        ) : (
          <EmptyState title={t('customers.noTickets')} />
        )}
      </div>
    </>
  )
}
