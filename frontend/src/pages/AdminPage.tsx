import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import {
  deleteAdminOrder,
  getAdminCapacity,
  getAdminOptions,
  getAdminOrders,
  signInAdministrator,
  signOutAdministrator,
  updateAdminOrder,
} from "../api/admin";
import AdminCapacity from "../components/admin/AdminCapacity";
import AdminFilters from "../components/admin/AdminFilters";
import AdminOrderEditor from "../components/admin/AdminOrderEditor";
import AdminOrderList from "../components/admin/AdminOrderList";
import AdminSignIn from "../components/admin/AdminSignIn";
import type { ServiceType } from "../types/customer";
import type {
  Administrator,
  AdminOrder,
  AdminOrderFilters,
  AdminOrderPatch,
  AdminStatusOption,
  CapacityDay,
} from "../types/admin";

const EMPTY_FILTERS: AdminOrderFilters = {
  search: "",
  status: "",
  serviceType: "",
  dueDate: "",
};
function addCalendarDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function AdminPage() {
  const [authState, setAuthState] = useState<
    "checking" | "signed-out" | "signed-in"
  >("checking");
  const [administrator, setAdministrator] = useState<Administrator | null>(
    null,
  );
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [statuses, setStatuses] = useState<AdminStatusOption[]>([]);
  const [shopToday, setShopToday] = useState("");
  const [capacity, setCapacity] = useState<CapacityDay[]>([]);
  const [filters, setFilters] = useState<AdminOrderFilters>(EMPTY_FILTERS);
  const [loginError, setLoginError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [capacityError, setCapacityError] = useState("");
  const [servicesError, setServicesError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [editorFields, setEditorFields] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isCapacityLoading, setIsCapacityLoading] = useState(false);

  function expireSession(error: unknown) {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    setAuthState("signed-out");
    setAdministrator(null);
    setOrders([]);
    setSelectedOrder(null);
    setLoginError(
      "Your administrator session has expired. Please sign in again.",
    );
    return true;
  }

  async function loadCapacity(today = shopToday) {
    if (!today) return;
    setIsCapacityLoading(true);
    setCapacityError("");
    try {
      setCapacity(await getAdminCapacity(today, addCalendarDays(today, 14)));
    } catch (error) {
      if (!expireSession(error))
        setCapacityError(
          error instanceof ApiError
            ? error.message
            : "We could not load capacity.",
        );
    } finally {
      setIsCapacityLoading(false);
    }
  }

  async function loadOptions() {
    setServicesError("");
    try {
      const options = await getAdminOptions();
      setServices(options.serviceTypes);
      setStatuses(options.statuses);
      setShopToday(options.today);
      return options.today;
    } catch (error) {
      setServices([]);
      setStatuses([]);
      setServicesError(
        error instanceof ApiError
          ? error.message
          : "We could not load the available services.",
      );
      return null;
    }
  }

  async function loadOrders(nextFilters = filters) {
    setIsBusy(true);
    setOrdersError("");
    try {
      const loaded = await getAdminOrders(nextFilters);
      setOrders(loaded);
      setSelectedOrder((current) =>
        current
          ? (loaded.find((order) => order.id === current.id) ?? null)
          : (loaded[0] ?? null),
      );
      setAuthState("signed-in");
      return "success" as const;
    } catch (error) {
      if (expireSession(error)) return "unauthorized" as const;
      else
        setOrdersError(
          error instanceof ApiError
            ? error.message
            : "We could not load orders.",
        );
      return "error" as const;
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const result = await loadOrders(EMPTY_FILTERS);
      if (result === "success") {
        const today = await loadOptions();
        if (today) await loadCapacity(today);
      } else if (result === "error") setAuthState("signed-in");
    })();
  }, []);

  async function signIn(email: string, password: string) {
    setIsBusy(true);
    setLoginError("");
    try {
      setAdministrator(await signInAdministrator(email, password));
      setAuthState("signed-in");
      const today = await loadOptions();
      await Promise.all([
        loadOrders(EMPTY_FILTERS),
        today ? loadCapacity(today) : Promise.resolve(),
      ]);
    } catch (error) {
      setAuthState("signed-out");
      setLoginError(
        error instanceof ApiError
          ? error.message
          : "We could not sign you in. Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function signOut() {
    setIsBusy(true);
    try {
      await signOutAdministrator();
      setAuthState("signed-out");
      setAdministrator(null);
      setOrders([]);
      setSelectedOrder(null);
      setLoginError("");
    } catch (error) {
      setOrdersError(
        error instanceof ApiError
          ? error.message
          : "We could not sign you out.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function saveOrder(patch: AdminOrderPatch) {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    setIsBusy(true);
    setEditorError("");
    setEditorFields({});
    try {
      await updateAdminOrder(orderId, patch);
      const refreshed = await getAdminOrders(filters);
      setOrders(refreshed);
      setSelectedOrder(
        refreshed.find((order) => order.id === orderId) ?? refreshed[0] ?? null,
      );
      await loadCapacity();
    } catch (error) {
      if (!expireSession(error)) {
        setEditorError(
          error instanceof ApiError
            ? error.message
            : "We could not update the order.",
        );
        setEditorFields(error instanceof ApiError ? error.fields : {});
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function removeOrder() {
    if (!selectedOrder) return;
    const orderId = selectedOrder.id;
    setIsBusy(true);
    setEditorError("");
    try {
      await deleteAdminOrder(orderId);
      const remaining = orders.filter((order) => order.id !== orderId);
      setOrders(remaining);
      setSelectedOrder(remaining[0] ?? null);
      await loadCapacity();
    } catch (error) {
      if (!expireSession(error))
        setEditorError(
          error instanceof ApiError
            ? error.message
            : "We could not delete the order.",
        );
    } finally {
      setIsBusy(false);
    }
  }

  if (authState === "checking")
    return (
      <section className="page-card">
        <p className="eyebrow">Administration</p>
        <h1>Loading workshop…</h1>
      </section>
    );
  if (authState === "signed-out")
    return (
      <AdminSignIn error={loginError} isSubmitting={isBusy} onSubmit={signIn} />
    );

  return (
    <div className="admin-dashboard">
      <section className="page-card admin-dashboard-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Workshop orders</h1>
          <p className="page-intro">
            Search, schedule, and move every repair through the workshop.
          </p>
        </div>
        <div className="admin-account">
          <span>{administrator?.email ?? "Signed-in administrator"}</span>
          <button
            className="button button-secondary button-compact"
            disabled={isBusy}
            type="button"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </section>
      <AdminCapacity
        days={capacity}
        error={capacityError}
        isLoading={isCapacityLoading}
        onRefresh={() => void loadCapacity()}
      />
      <section className="admin-panel" aria-labelledby="orders-heading">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Order queue</p>
            <h2 id="orders-heading">
              All orders <span className="admin-count">{orders.length}</span>
            </h2>
          </div>
        </div>
        <AdminFilters
          filters={filters}
          services={services}
          statuses={statuses}
          isLoading={isBusy}
          onChange={setFilters}
          onSubmit={() => void loadOrders(filters)}
          onClear={() => {
            setFilters(EMPTY_FILTERS);
            void loadOrders(EMPTY_FILTERS);
          }}
        />
        {ordersError && (
          <p className="error-message" role="alert">
            {ordersError}
          </p>
        )}
        {servicesError && (
          <p className="error-message" role="alert">
            {servicesError} Refresh the page before editing service types.
          </p>
        )}
        {isBusy && orders.length === 0 ? (
          <p className="admin-empty">Loading orders…</p>
        ) : (
          <AdminOrderList
            orders={orders}
            statuses={statuses}
            selectedId={selectedOrder?.id}
            disabled={isBusy}
            onSelect={(order) => {
              setSelectedOrder(order);
              setEditorError("");
              setEditorFields({});
            }}
          />
        )}
      </section>
      {selectedOrder && (
        <AdminOrderEditor
          order={selectedOrder}
          services={services}
          statuses={statuses}
          isSaving={isBusy}
          error={editorError}
          fields={editorFields}
          onSave={saveOrder}
          onDelete={removeOrder}
        />
      )}
    </div>
  );
}
