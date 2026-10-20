// Всплывающие сообщения об исходе задания: цвет и значок исхода, исчезают сами.
import { useEffect, type CSSProperties } from 'react';
import { useGameStore, type Toast as ToastData } from '../store/gameStore';
import { OUTCOME_LOOK, taskTitle } from './labels';
import Vx from './Vx';
import Icon from './icons';

const SHOW_MS = 3500;

function Toast({ toast }: { toast: ToastData }) {
  const dismiss = useGameStore((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(toast.id), SHOW_MS);
    return () => clearTimeout(t);
  }, [toast.id, dismiss]);

  const look = OUTCOME_LOOK[toast.outcome];
  return (
    <Vx className="toast" style={{ '--oc': look.color } as CSSProperties} onClick={() => dismiss(toast.id)}>
      <Icon name={look.icon} />
      {toast.levelUp
        ? <span>{toast.pickerName}: <b>новый уровень {toast.levelUp}!</b> Очко — в итогах смены</span>
        : toast.expired
        ? <span>{taskTitle({ type: toast.taskType, number: toast.taskNumber })}: <b>не успели взять</b></span>
        : <span>{taskTitle({ type: toast.taskType, number: toast.taskNumber })} · {toast.pickerName}: <b>{look.name}</b></span>}
    </Vx>
  );
}

export default function Toasts() {
  const toasts = useGameStore((s) => s.ui.toasts);
  return (
    <div className="toasts">
      {toasts.map((t) => <Toast key={t.id} toast={t} />)}
    </div>
  );
}
