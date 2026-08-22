import type { CustomerOrder } from '../../types/customer'
import { formatDueDate } from '../../utils/formatDueDate'

const statusLabels: Record<string, string> = {
  NEW: 'New',
  IN_PROGRESS: 'In progress',
  WAITING_FOR_CUSTOMER_PICKUP: 'Waiting for customer pickup',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

type CustomerOrderCardProps = {
  order: CustomerOrder
}

export default function CustomerOrderCard({ order }: CustomerOrderCardProps) {
  return (
    <article className="order-card">
      <div className="order-card-heading">
        <div>
          <p className="step-label">Order {order.reference}</p>
          <h3>{order.bikeBrand}</h3>
        </div>
        <span className="status-badge">{statusLabels[order.status] ?? order.status}</span>
      </div>
      <dl className="order-details">
        <div><dt>Customer</dt><dd>{order.customerName}</dd></div>
        <div><dt>Email</dt><dd>{order.emailAddress}</dd></div>
        <div><dt>Phone</dt><dd>{order.phoneNumber}</dd></div>
        <div><dt>Expected due date</dt><dd>{formatDueDate(order.expectedDueDate)}</dd></div>
        <div><dt>Services</dt><dd>{order.serviceTypes.map((service) => service.displayName).join(', ')}</dd></div>
        {order.notes && <div><dt>Notes</dt><dd>{order.notes}</dd></div>}
      </dl>
    </article>
  )
}
