import type { CustomerOrder, ServiceType, SubmittedOrder } from '../types/customer'
import { ApiError, requestJson } from './client'

const LOOKUP_ERROR = 'We could not search for orders. Please try again.'
const ORDER_OPTIONS_ERROR = 'We could not load the available services. Please try again.'
const SUBMISSION_ERROR = 'We could not place your order. Please try again.'

export type CustomerOrderSubmission = {
  customerName: string
  phoneNumber: string
  emailAddress: string
  bikeBrand: string
  serviceTypes: string[]
  notes: string
}

export async function getCustomerOrderOptions(): Promise<ServiceType[]> {
  const body = await requestJson<{ serviceTypes?: ServiceType[] }>(
    '/api/customer/order-options',
    undefined,
    ORDER_OPTIONS_ERROR,
  )

  if (!Array.isArray(body.serviceTypes)) throw new ApiError(ORDER_OPTIONS_ERROR)
  return body.serviceTypes
}

export async function lookupCustomerOrders(value: string): Promise<CustomerOrder[]> {
  const body = await requestJson<{ orders?: CustomerOrder[] }>(
    '/api/customer/order-lookups',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    },
    LOOKUP_ERROR,
  )

  if (body.orders !== undefined && !Array.isArray(body.orders)) {
    throw new ApiError(LOOKUP_ERROR)
  }

  return body.orders ?? []
}

export async function submitCustomerOrder(input: CustomerOrderSubmission): Promise<SubmittedOrder> {
  const body = await requestJson<{
    order?: SubmittedOrder
    error?: string
    fields?: Record<string, string>
  }>(
    '/api/customer/orders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: input.customerName.trim(),
        phoneNumber: input.phoneNumber.trim(),
        emailAddress: input.emailAddress.trim(),
        bikeBrand: input.bikeBrand.trim(),
        serviceTypes: input.serviceTypes,
        notes: input.notes.trim() || undefined,
      }),
    },
    SUBMISSION_ERROR,
  )

  if (!body.order) throw new ApiError(body.error ?? SUBMISSION_ERROR, body.fields)
  return body.order
}
