/**
 * Push notification service — sends push notifications via ntfy.sh (MVP).
 * Can be upgraded to APNs later.
 */

const NTFY_TOPIC = process.env['NTFY_TOPIC'] ?? '';
const NTFY_SERVER = process.env['NTFY_SERVER'] ?? 'https://ntfy.sh';

export interface PushPayload {
  title: string;
  message: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  tags?: string[];
  click?: string;
}

export async function sendPush(payload: PushPayload): Promise<boolean> {
  if (!NTFY_TOPIC) {
    console.log('[push] NTFY_TOPIC not set, skipping push notification');
    return false;
  }

  try {
    const headers: Record<string, string> = {
      'Title': payload.title,
    };

    if (payload.priority) headers['Priority'] = payload.priority;
    if (payload.tags?.length) headers['Tags'] = payload.tags.join(',');
    if (payload.click) headers['Click'] = payload.click;

    const res = await fetch(`${NTFY_SERVER}/${NTFY_TOPIC}`, {
      method: 'POST',
      headers,
      body: payload.message,
    });

    if (res.ok) {
      console.log(`[push] Notification sent: ${payload.title}`);
      return true;
    }

    console.warn(`[push] Failed to send: ${res.status} ${res.statusText}`);
    return false;
  } catch (err) {
    console.error(`[push] Error: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Send a task completion notification.
 */
export async function notifyTaskComplete(taskId: string, instruction: string, success: boolean): Promise<void> {
  await sendPush({
    title: success ? 'Task Complete' : 'Task Failed',
    message: instruction.slice(0, 200),
    priority: success ? 'default' : 'high',
    tags: success ? ['white_check_mark'] : ['x'],
  });
}
