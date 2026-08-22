import { Link } from 'react-router-dom'
import type { SubmittedOrder } from '../../types/customer'
import { formatDueDate } from '../../utils/formatDueDate'

type OrderConfirmationProps = {
  order: SubmittedOrder
}

export default function OrderConfirmation({ order }: OrderConfirmationProps) {
  return (
    <section className="page-card compact-page-card confirmation-card">
      <p className="eyebrow">Order confirmed</p>
      <h1>Your order is booked</h1>
      <p className="page-intro">Keep your reference safe. You can use it to find this order at any time.</p>
      <div className="confirmation-reference">
        <span>Order reference</span>
        <strong>{order.reference}</strong>
      </div>
      <dl className="confirmation-details">
        <div><dt>Status</dt><dd>New</dd></div>
        <div><dt>Expected due date</dt><dd>{formatDueDate(order.expectedDueDate)}</dd></div>
      </dl>
      <Link className="button button-primary" to="/customer">Back to customer home</Link>
    </section>
  )
}
