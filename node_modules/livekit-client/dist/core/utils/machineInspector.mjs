/**
 * Opt-in registry that lets a development tool observe the state machines driving the connection
 * layer.
 *
 * The machines are private to the objects that own them and, more importantly, do not outlive them:
 * a full reconnect replaces the whole engine along with its `SignalClient`, so anything watching a
 * single machine reference goes blind exactly when the interesting part starts. Machines therefore
 * announce themselves here as they are constructed, and a subscriber sees the whole succession.
 *
 * Nothing is recorded until {@link enableMachineInspector} is called, which no shipping code does —
 * with the registry off, announcing is a comparison and a return.
 */
/** Kept small: enough for a panel opened mid-session to see how the connection got where it is. */
/** Announces a machine to whatever is watching. A no-op unless the inspector was enabled. */
function announceMachine(label, machine) {
  {
    return;
  }
}export{announceMachine};//# sourceMappingURL=machineInspector.mjs.map
