export interface ActionState {
  error: string | null;
  status: string | null;
}

export const IDLE_ACTION_STATE: ActionState = { error: null, status: null };