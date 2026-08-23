import { useCallback, useEffect, useRef, useState } from "react";
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
import type { ServiceType } from "../types/order";
import type {
  Administrator,
  AdminOrder,
  AdminOrderFilters,
  AdminOrderPatch,
  AdminStatusOption,
  CapacityDay,
} from "../types/admin";

export const EMPTY_ADMIN_FILTERS: AdminOrderFilters = {
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

function messageFor(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function useAdminDashboard() {
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
  const [filters, setFilters] =
    useState<AdminOrderFilters>(EMPTY_ADMIN_FILTERS);
  const [loginError, setLoginError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [capacityError, setCapacityError] = useState("");
  const [servicesError, setServicesError] = useState("");
  const [editorError, setEditorError] = useState("");
  const [editorFields, setEditorFields] = useState<Record<string, string>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isCapacityLoading, setIsCapacityLoading] = useState(false);
  const orderRequest = useRef(0);

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
      setCapacity(await getAdminCapacity(today, addCalendarDays(today, 13)));
    } catch (error) {
      if (!expireSession(error))
        setCapacityError(messageFor(error, "We could not load capacity."));
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
        messageFor(error, "We could not load the available services."),
      );
      return null;
    }
  }

  async function loadOrders(nextFilters = filters) {
    const request = ++orderRequest.current;
    setIsBusy(true);
    setOrdersError("");
    try {
      const loaded = await getAdminOrders(nextFilters);
      if (request !== orderRequest.current) return "stale" as const;
      setOrders(loaded);
      setSelectedOrder((current) =>
        current
          ? (loaded.find((order) => order.id === current.id) ?? null)
          : null,
      );
      setAuthState("signed-in");
      return "success" as const;
    } catch (error) {
      if (request !== orderRequest.current) return "stale" as const;
      if (expireSession(error)) return "unauthorized" as const;
      setOrdersError(messageFor(error, "We could not load orders."));
      return "error" as const;
    } finally {
      if (request === orderRequest.current) setIsBusy(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const result = await loadOrders(EMPTY_ADMIN_FILTERS);
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
        loadOrders(EMPTY_ADMIN_FILTERS),
        today ? loadCapacity(today) : Promise.resolve(),
      ]);
    } catch (error) {
      setAuthState("signed-out");
      setLoginError(
        messageFor(error, "We could not sign you in. Please try again."),
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
      setOrdersError(messageFor(error, "We could not sign you out."));
    } finally {
      setIsBusy(false);
    }
  }

  function selectOrder(order: AdminOrder) {
    setSelectedOrder(order);
    setEditorError("");
    setEditorFields({});
  }
  const closeEditor = useCallback(() => {
    setSelectedOrder(null);
    setEditorError("");
    setEditorFields({});
  }, []);

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
      setSelectedOrder(refreshed.find((order) => order.id === orderId) ?? null);
      await loadCapacity();
    } catch (error) {
      if (!expireSession(error)) {
        setEditorError(messageFor(error, "We could not update the order."));
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
      setOrders((current) => current.filter((order) => order.id !== orderId));
      closeEditor();
      await loadCapacity();
    } catch (error) {
      if (!expireSession(error))
        setEditorError(messageFor(error, "We could not delete the order."));
    } finally {
      setIsBusy(false);
    }
  }

  return {
    administrator,
    authState,
    capacity,
    capacityError,
    closeEditor,
    editorError,
    editorFields,
    filters,
    isBusy,
    isCapacityLoading,
    loginError,
    orders,
    ordersError,
    selectedOrder,
    services,
    servicesError,
    setFilters,
    signIn,
    signOut,
    loadCapacity,
    loadOrders,
    removeOrder,
    saveOrder,
    selectOrder,
    statuses,
  };
}
