import { useEffect, useRef, useCallback, useState } from "react";

const WS_BASE = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

/**
 * Hook theo dõi GPS shipper realtime.
 * 
 * Dùng:
 * const { location, isConnected } = useOrderTracking(orderId);
 */
export function useOrderTracking(orderId) {
  const [location, setLocation] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!orderId) return;

    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`${WS_BASE}/tracking/${orderId}/?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => setIsConnected(true);
    ws.onclose = () => setIsConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "location_update") {
        setLocation({ lat: data.lat, lng: data.lng, speed: data.speed });
      }
    };

    return () => ws.close();
  }, [orderId]);

  return { location, isConnected };
}

/**
 * Hook cho Shipper gửi GPS location.
 * 
 * Dùng:
 * const { startTracking, stopTracking, isTracking } = useShipperTracking(orderId);
 */
export function useShipperTracking(orderId) {
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const [isTracking, setIsTracking] = useState(false);

  const sendLocation = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      wsRef.current.send(JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        speed: pos.coords.speed,
      }));
    });
  }, []);

  const startTracking = useCallback(() => {
    if (!orderId) return;
    const token = localStorage.getItem("access_token");
    const ws = new WebSocket(`${WS_BASE}/tracking/${orderId}/?token=${token}`);
    wsRef.current = ws;
    ws.onopen = () => {
      setIsTracking(true);
      intervalRef.current = setInterval(sendLocation, 7000); // Mỗi 7 giây
    };
  }, [orderId, sendLocation]);

  const stopTracking = useCallback(() => {
    clearInterval(intervalRef.current);
    wsRef.current?.close();
    setIsTracking(false);
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  return { startTracking, stopTracking, isTracking };
}

/**
 * Hook nhận notification realtime.
 * 
 * Dùng:
 * const { notifications } = useNotifications();
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) return;

    const ws = new WebSocket(`${WS_BASE}/notifications/?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "notification") {
        setNotifications((prev) => [data, ...prev]);
        // Có thể show toast ở đây
      }
    };

    return () => ws.close();
  }, []);

  return { notifications };
}
