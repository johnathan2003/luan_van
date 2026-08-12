import { create } from "zustand";
import { cartAPI } from "../services/api";
import toast from "react-hot-toast";

const useCartStore = create((set, get) => ({
  cart: null,
  isLoading: false,

  fetchCart: async () => {
    set({ isLoading: true });
    try {
      const { data } = await cartAPI.get();
      set({ cart: data, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  addItem: async (productId, quantity = 1, variantId = null) => {
    try {
      const { data } = await cartAPI.addItem({ product_id: productId, quantity, variant_id: variantId });
      set({ cart: data });
      toast.success("Đã thêm vào giỏ hàng");
    } catch {
      toast.error("Không thể thêm vào giỏ hàng");
    }
  },

  removeItem: async (productId) => {
    try {
      const { data } = await cartAPI.removeItem(productId);
      set({ cart: data });
      toast.success("Đã xoá sản phẩm");
    } catch {
      toast.error("Không thể xoá sản phẩm");
    }
  },

  clearCart: async () => {
    try {
      await cartAPI.clear();
      set({ cart: null });
    } catch {}
  },

  get totalItems() {
    return get().cart?.total_items || 0;
  },
}));

export default useCartStore;
