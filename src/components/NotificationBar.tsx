import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useParameters, useWishlist } from "@/lib/data";
import { useCareSchedule, useLogNotification, useNotifications, usePauseNotifications } from "@/lib/rhythm";
import { pauseUntil, pickNotification } from "@/lib/notify";
import { useDaily } from "@/lib/useDaily";

/**
 * Högst en avisering per dag, aldrig efter 20:00, och pausknappen sitter på
 * själva aviseringen.
 */
export function NotificationBar() {
  const { daily, today } = useDaily();
  const { data: schedule } = useCareSchedule();
  const { data: params } = useParameters();
  const { data: wishlist = [] } = useWishlist();
  const { data: log = [] } = useNotifications();
  const logNotification = useLogNotification();
  const pause = usePauseNotifications();
  const [dismissed, setDismissed] = useState(false);

  const alreadySentToday = log.some((n) => n.sent_on === today);
  const notification = pickNotification({
    today,
    hour: new Date().getHours(),
    schedule,
    daily,
    wishlist,
    params,
    alreadySentToday,
  });

  useEffect(() => {
    if (!notification || alreadySentToday || logNotification.isPending) return;
    logNotification.mutate({
      sent_on: today,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.kind, alreadySentToday, today]);

  if (!notification || dismissed) return null;

  return (
    <div className="panel mb-6 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-15 font-medium">{notification.title}</div>
          <p className="mt-1 text-13 text-muted-foreground">{notification.body}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted-foreground"
          aria-label="Stäng"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-13">
        {notification.to && (
          <Link
            to={notification.to}
            onClick={() => setDismissed(true)}
            className="rounded-[6px] bg-signal px-3 py-1.5 font-medium text-primary-foreground"
          >
            {notification.actionLabel ?? "Öppna"}
          </Link>
        )}
        <button
          onClick={() => {
            pause.mutate(pauseUntil(today, 7));
            setDismissed(true);
          }}
          className="text-muted-foreground underline underline-offset-4"
        >
          Pausa i en vecka
        </button>
      </div>
    </div>
  );
}
