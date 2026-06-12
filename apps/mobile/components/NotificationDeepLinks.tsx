import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";

import { notificationRouteFor } from "@/lib/notifications";

/**
 * Leitet Antippen einer Benachrichtigung an die richtige Stelle weiter –
 * sowohl aus dem Hintergrund als auch beim Kaltstart (App war beendet).
 */
export function NotificationDeepLinks() {
  const router = useRouter();
  const handledColdStart = useRef(false);

  useEffect(() => {
    let active = true;

    function navigate(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = notificationRouteFor(data);
      if (route) router.push(route as never);
    }

    // Kaltstart: App wurde durch Antippen einer Benachrichtigung geöffnet.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (active && response && !handledColdStart.current) {
          handledColdStart.current = true;
          navigate(response);
        }
      })
      .catch(() => undefined);

    // Hintergrund/Vordergrund: Nutzer tippt eine Benachrichtigung an.
    const subscription = Notifications.addNotificationResponseReceivedListener(navigate);
    return () => {
      active = false;
      subscription.remove();
    };
  }, [router]);

  return null;
}
