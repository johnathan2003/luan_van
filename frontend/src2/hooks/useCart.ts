import { useEffect } from 'react'
import { useAppSelector, useAppDispatch } from '../store/hooks'
import { fetchCart, addToCart, removeFromCart, updateCartItem, clearCart } from '../store/slices/cartSlice'
import { toast } from 'react-toastify'

export const useCart = () => {
  const dispatch = useAppDispatch()
  const { cart, loading } = useAppSelector(s => s.cart)
  const { isAuthenticated } = useAppSelector(s => s.auth)

  useEffect(() => {
    if (isAuthenticated) dispatch(fetchCart())
  }, [isAuthenticated, dispatch])

  const add = async (product_id: number, quantity = 1) => {
    const result = await dispatch(addToCart({ product_id, quantity }))
    if (addToCart.fulfilled.match(result)) {
      toast.success('Đã thêm vào giỏ hàng')
    } else {
      toast.error(result.payload as string || 'Thêm vào giỏ thất bại')
    }
  }

  const remove = (cart_id: number) => dispatch(removeFromCart(cart_id))
  const update = (cart_id: number, quantity: number) => dispatch(updateCartItem({ cart_id, quantity }))
  const clear = () => dispatch(clearCart())

  return { cart, loading, add, remove, update, clear }
}
