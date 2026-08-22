import { type SubmitEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/client'
import { lookupCustomerOrders } from '../api/customer'
import CustomerOrderResults from '../components/customer/CustomerOrderResults'
import OrderLookupCard from '../components/customer/OrderLookupCard'
import type { CustomerOrder } from '../types/customer'

export default function CustomerPage() {
  const [lookupValue, setLookupValue] = useState('')
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [error, setError] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  async function handleLookup(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setOrders([])
    setIsSearching(true)

    try {
      setOrders(await lookupCustomerOrders(lookupValue))
    } catch (error) {
      setError(error instanceof ApiError
        ? error.message
        : 'We could not search for orders. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <>
      <section className="page-card customer-hero">
        <div>
          <p className="eyebrow">Bike service, made simple</p>
          <h1>How can we help your bike?</h1>
          <p className="page-intro">
            Find an existing maintenance order or tell us what your bike needs next.
          </p>
        </div>

        <div className="customer-actions">
          <OrderLookupCard
            isSearching={isSearching}
            lookupValue={lookupValue}
            onLookupValueChange={setLookupValue}
            onSubmit={handleLookup}
          />

          <section className="action-card action-card-new" aria-labelledby="new-order-heading">
            <div>
              <p className="step-label">Need a repair?</p>
              <h2 id="new-order-heading">Place a new order</h2>
              <p>Choose the maintenance your bike needs and we’ll find the earliest available day.</p>
            </div>
            <Link className="button button-secondary" to="/customer/orders/new">
              Start a new order
            </Link>
          </section>
        </div>
      </section>

      <CustomerOrderResults error={error} orders={orders} />
    </>
  )
}
