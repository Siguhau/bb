import { type SubmitEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import {
  getCustomerOrderOptions,
  submitCustomerOrder,
  type CustomerOrderSubmission,
} from "../../api/customer";
import type { ServiceType, SubmittedOrder } from "../../types/customer";

type CustomerOrderFormProps = {
  onSubmitted: (order: SubmittedOrder) => void;
};

const initialValues: CustomerOrderSubmission = {
  customerName: "",
  phoneNumber: "",
  emailAddress: "",
  bikeBrand: "",
  serviceTypes: [],
  notes: "",
};

export default function CustomerOrderForm({
  onSubmitted,
}: CustomerOrderFormProps) {
  const [values, setValues] = useState(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceOptionsError, setServiceOptionsError] = useState("");

  useEffect(() => {
    let isCurrent = true;

    getCustomerOrderOptions()
      .then((options) => {
        if (isCurrent) setServiceTypes(options);
      })
      .catch(() => {
        if (isCurrent)
          setServiceOptionsError(
            "We could not load the available services. Please try again.",
          );
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  function updateField(
    field: keyof Omit<CustomerOrderSubmission, "serviceTypes">,
    value: string,
  ) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: "" }));
  }

  function toggleService(code: string) {
    setValues((current) => ({
      ...current,
      serviceTypes: current.serviceTypes.includes(code)
        ? current.serviceTypes.filter((serviceType) => serviceType !== code)
        : [...current.serviceTypes, code],
    }));
    setFieldErrors((current) => ({ ...current, serviceTypes: "" }));
  }

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (values.serviceTypes.length === 0) {
      setFieldErrors((current) => ({
        ...current,
        serviceTypes: "Select at least one service.",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      onSubmitted(await submitCustomerOrder(values));
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(error.fields);
        setFormError(error.message);
      } else {
        setFormError("We could not place your order. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="page-card compact-page-card">
      <p className="eyebrow">New maintenance order</p>
      <h1>Book a service</h1>
      <p className="page-intro">
        Tell us about you, your bike, and the maintenance it needs.
      </p>

      <form className="order-form" onSubmit={handleSubmit}>
        {formError && (
          <p className="error-message" role="alert">
            {formError}
          </p>
        )}

        <div className="form-field">
          <label htmlFor="customer-name">Customer name</label>
          <input
            aria-describedby={
              fieldErrors.customerName ? "customer-name-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.customerName)}
            autoComplete="name"
            id="customer-name"
            maxLength={120}
            onChange={(event) =>
              updateField("customerName", event.target.value)
            }
            required
            type="text"
            value={values.customerName}
          />
          {fieldErrors.customerName && (
            <p className="field-error" id="customer-name-error">
              {fieldErrors.customerName}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="phone-number">Phone number</label>
          <input
            aria-describedby={
              fieldErrors.phoneNumber ? "phone-number-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.phoneNumber)}
            autoComplete="tel"
            id="phone-number"
            maxLength={30}
            onChange={(event) => updateField("phoneNumber", event.target.value)}
            required
            type="tel"
            value={values.phoneNumber}
          />
          {fieldErrors.phoneNumber && (
            <p className="field-error" id="phone-number-error">
              {fieldErrors.phoneNumber}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="email-address">Email address</label>
          <input
            aria-describedby={
              fieldErrors.emailAddress ? "email-address-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.emailAddress)}
            autoComplete="email"
            id="email-address"
            maxLength={254}
            onChange={(event) =>
              updateField("emailAddress", event.target.value)
            }
            required
            type="email"
            value={values.emailAddress}
          />
          {fieldErrors.emailAddress && (
            <p className="field-error" id="email-address-error">
              {fieldErrors.emailAddress}
            </p>
          )}
        </div>

        <div className="form-field">
          <label htmlFor="bike-brand">Bike brand</label>
          <input
            aria-describedby={
              fieldErrors.bikeBrand ? "bike-brand-error" : undefined
            }
            aria-invalid={Boolean(fieldErrors.bikeBrand)}
            id="bike-brand"
            maxLength={120}
            onChange={(event) => updateField("bikeBrand", event.target.value)}
            required
            type="text"
            value={values.bikeBrand}
          />
          {fieldErrors.bikeBrand && (
            <p className="field-error" id="bike-brand-error">
              {fieldErrors.bikeBrand}
            </p>
          )}
        </div>

        <fieldset
          aria-describedby={
            fieldErrors.serviceTypes ? "service-types-error" : undefined
          }
          className="service-fieldset"
        >
          <legend>Services needed</legend>
          {serviceOptionsError && (
            <p className="field-error" role="alert">
              {serviceOptionsError}
            </p>
          )}
          {serviceTypes.length === 0 && !serviceOptionsError && (
            <p className="field-help">Loading services…</p>
          )}
          <div className="service-options">
            {serviceTypes.map((serviceType) => (
              <label className="service-option" key={serviceType.code}>
                <input
                  checked={values.serviceTypes.includes(serviceType.code)}
                  onChange={() => toggleService(serviceType.code)}
                  type="checkbox"
                />
                <span>{serviceType.displayName}</span>
              </label>
            ))}
          </div>
          {fieldErrors.serviceTypes && (
            <p className="field-error" id="service-types-error">
              {fieldErrors.serviceTypes}
            </p>
          )}
        </fieldset>

        <div className="form-field">
          <label htmlFor="notes">
            Notes <span className="optional-label">Optional</span>
          </label>
          <textarea
            aria-describedby={fieldErrors.notes ? "notes-error" : undefined}
            aria-invalid={Boolean(fieldErrors.notes)}
            id="notes"
            maxLength={2000}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={5}
            value={values.notes}
          />
          {fieldErrors.notes && (
            <p className="field-error" id="notes-error">
              {fieldErrors.notes}
            </p>
          )}
        </div>

        <div className="form-actions">
          <button
            className="button button-primary"
            disabled={isSubmitting || serviceTypes.length === 0}
            type="submit"
          >
            {isSubmitting ? "Placing order…" : "Place order"}
          </button>
          <Link className="text-link" to="/customer">
            Cancel and go back
          </Link>
        </div>
      </form>
    </section>
  );
}
