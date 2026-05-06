import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";
import useCartStore from "../store/cartStore";

// ─── useAuth ───────────────────────────────────────────────
export function useAuth() {
  const store = useAuthStore();
  const navigate = useNavigate();

  const loginAndRedirect = async (email, password) => {
    const user = await store.login(email, password);
    const redirectMap = {
      buyer: "/",
      seller: "/seller/dashboard",
      shipper: "/shipper/deliveries",
      admin: "/admin/overview",
    };
    navigate(redirectMap[user.role] || "/");
  };

  const logoutAndRedirect = async () => {
    await store.logout();
    navigate("/login");
  };

  return { ...store, loginAndRedirect, logoutAndRedirect };
}

// ─── useCart ───────────────────────────────────────────────
export function useCart() {
  const store = useCartStore();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) store.fetchCart();
  }, [isAuthenticated]);

  return store;
}

// ─── useInfiniteScroll ─────────────────────────────────────
export function useInfiniteScroll(callback) {
  const observer = useRef();

  const lastElementRef = useCallback(
    (node) => {
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) callback();
      });
      if (node) observer.current.observe(node);
    },
    [callback]
  );

  return lastElementRef;
}

// ─── useFormatPrice ────────────────────────────────────────
export function useFormatPrice() {
  const format = (price) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);
  return { format };
}

// ─── useDebounce ───────────────────────────────────────────
export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useRef(value);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      debouncedValue.current = value;
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return debouncedValue.current;
}
