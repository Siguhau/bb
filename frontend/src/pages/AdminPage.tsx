import AdminCapacity from "../components/admin/AdminCapacity";
import Alert from "../components/Alert";
import AdminFilters from "../components/admin/AdminFilters";
import AdminOrderEditor from "../components/admin/AdminOrderEditor";
import AdminOrderList from "../components/admin/AdminOrderList";
import AdminSignIn from "../components/admin/AdminSignIn";
import {
  EMPTY_ADMIN_FILTERS,
  useAdminDashboard,
} from "../hooks/useAdminDashboard";

type HeaderProps = {
  email?: string;
  isBusy: boolean;
  onSignOut: () => void;
};

function DashboardHeader({ email, isBusy, onSignOut }: HeaderProps) {
  return (
    <section className="page-card admin-dashboard-header">
      <div>
        <p className="eyebrow">Administration</p>
        <h1>Workshop orders</h1>
        <p className="page-intro">
          Search, schedule, and move every repair through the workshop.
        </p>
      </div>
      <div className="admin-account">
        <span>{email ?? "Signed-in administrator"}</span>
        <button
          className="button button-secondary button-compact"
          disabled={isBusy}
          type="button"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>
    </section>
  );
}

export default function AdminPage() {
  const admin = useAdminDashboard();

  if (admin.authState === "checking")
    return (
      <section className="page-card">
        <p className="eyebrow">Administration</p>
        <h1>Loading workshop…</h1>
      </section>
    );

  if (admin.authState === "signed-out")
    return (
      <AdminSignIn
        error={admin.loginError}
        isSubmitting={admin.isBusy}
        onSubmit={admin.signIn}
      />
    );

  return (
    <div className="admin-dashboard">
      <DashboardHeader
        email={admin.administrator?.email}
        isBusy={admin.isBusy}
        onSignOut={() => void admin.signOut()}
      />
      <AdminCapacity
        days={admin.capacity}
        error={admin.capacityError}
        isLoading={admin.isCapacityLoading}
        onRefresh={() => void admin.loadCapacity()}
      />
      <section className="admin-panel" aria-labelledby="orders-heading">
        <div className="admin-panel-heading">
          <div>
            <p className="eyebrow">Order queue</p>
            <h2 id="orders-heading">
              All orders{" "}
              <span className="admin-count">{admin.orders.length}</span>
            </h2>
          </div>
        </div>
        <AdminFilters
          filters={admin.filters}
          services={admin.services}
          statuses={admin.statuses}
          isLoading={admin.isBusy}
          onChange={admin.setFilters}
          onSubmit={(filters) => void admin.loadOrders(filters)}
          onClear={() => {
            admin.setFilters(EMPTY_ADMIN_FILTERS);
            void admin.loadOrders(EMPTY_ADMIN_FILTERS);
          }}
        />
        {admin.ordersError && <Alert>{admin.ordersError}</Alert>}
        {admin.servicesError && (
          <Alert>
            {admin.servicesError} Refresh the page before editing service types.
          </Alert>
        )}
        {admin.isBusy && admin.orders.length === 0 ? (
          <p className="admin-empty">Loading orders…</p>
        ) : (
          <AdminOrderList
            orders={admin.orders}
            statuses={admin.statuses}
            selectedId={admin.selectedOrder?.id}
            disabled={admin.isBusy}
            onSelect={admin.selectOrder}
          />
        )}
      </section>
      {admin.selectedOrder && (
        <AdminOrderEditor
          order={admin.selectedOrder}
          services={admin.services}
          statuses={admin.statuses}
          isSaving={admin.isBusy}
          error={admin.editorError}
          fields={admin.editorFields}
          onClose={admin.closeEditor}
          onSave={admin.saveOrder}
          onDelete={admin.removeOrder}
        />
      )}
    </div>
  );
}
