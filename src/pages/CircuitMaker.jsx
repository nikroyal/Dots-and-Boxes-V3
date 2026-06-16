import { useCallback, useMemo, useRef, useState } from 'react';
import { Download, FolderOpen, Plus, RotateCcw, Save, Trash2, Undo2, Zap } from 'lucide-react';
import { useConfirm } from '../components/ConfirmDialog';
import { usePrompt } from '../components/PromptDialog';

const PROJECTS_KEY = 'axiom-circuit-projects';
const GATE_TYPES = [
  ['input', 'Switch'],
  ['output', 'LED'],
  ['and', 'AND'],
  ['or', 'OR'],
  ['not', 'NOT'],
  ['xor', 'XOR'],
  ['nand', 'NAND'],
  ['nor', 'NOR'],
  ['buf', 'BUFFER'],
];

const initialState = { components: [], wires: [], nextId: 1 };

function makeComponent(type, id, x, y) {
  return {
    id,
    type,
    x,
    y,
    value: type === 'input' ? false : undefined,
    color: type === 'output' ? '#35d399' : undefined,
    label: GATE_TYPES.find(([key]) => key === type)?.[1] || type,
  };
}

function readProjects() {
  try { return JSON.parse(window.localStorage.getItem(PROJECTS_KEY) || '{}'); }
  catch { return {}; }
}

function writeProjects(projects) {
  try { window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); return true; }
  catch { return false; }
}

function evaluateCircuit(state) {
  let values = new Map(state.components.map(component => [component.id, { in: false, out: component.type === 'input' ? !!component.value : false }]));

  // Pre-compute incoming connections to avoid O(N) filter per component per tick
  const inputsByComponent = new Map();
  for (const wire of state.wires) {
    if (!inputsByComponent.has(wire.to)) {
      inputsByComponent.set(wire.to, []);
    }
    inputsByComponent.get(wire.to).push(wire.from);
  }

  for (let i = 0; i < 8; i++) {
    const next = new Map();
    for (const component of state.components) {
      const incomingIds = inputsByComponent.get(component.id);
      const a = incomingIds?.[0] ? !!values.get(incomingIds[0])?.out : false;
      const b = incomingIds?.[1] ? !!values.get(incomingIds[1])?.out : false;
      let out = false;
      if (component.type === 'input') out = !!component.value;
      else if (component.type === 'output') out = a;
      else if (component.type === 'and') out = a && b;
      else if (component.type === 'or') out = a || b;
      else if (component.type === 'not') out = !a;
      else if (component.type === 'xor') out = a !== b;
      else if (component.type === 'nand') out = !(a && b);
      else if (component.type === 'nor') out = !(a || b);
      else if (component.type === 'buf') out = a;
      next.set(component.id, { in: a, out });
    }
    values = next;
  }
  return values;
}

function sourcePoint(component) {
  return { x: component.x + 170, y: component.y + 44 };
}

function targetPoint(component) {
  return { x: component.x, y: component.y + 44 };
}

export default function CircuitMaker() {
  const boardRef = useRef(null);
  const [state, setState] = useState(initialState);
  const [history, setHistory] = useState([initialState]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selected, setSelected] = useState([]);
  const [drag, setDrag] = useState(null);
  const [wireDrag, setWireDrag] = useState(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('Untitled circuit');
  const { confirm, dialog: confirmDialogEl } = useConfirm();
  const { prompt, dialog: promptDialogEl } = usePrompt();

  const values = useMemo(() => evaluateCircuit(state), [state]);
  const projects = projectOpen ? readProjects() : {};

  const commit = useCallback((next) => {
    setState(next);
    setHistory(current => {
      const trimmed = current.slice(0, historyIndex + 1);
      return [...trimmed, next];
    });
    setHistoryIndex(index => index + 1);
  }, [historyIndex]);

  const addComponent = (type) => {
    const id = `g${state.nextId}`;
    const offset = state.components.length * 22;
    const next = {
      ...state,
      nextId: state.nextId + 1,
      components: [...state.components, makeComponent(type, id, 70 + (offset % 260), 70 + (offset % 180))],
    };
    commit(next);
  };

  const clear = () => {
    commit(initialState);
    setSelected([]);
    setProjectName('Untitled circuit');
  };

  const undo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    setHistoryIndex(nextIndex);
    setState(history[nextIndex]);
    setSelected([]);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    setHistoryIndex(nextIndex);
    setState(history[nextIndex]);
    setSelected([]);
  };

  const sample = () => {
    const components = [
      makeComponent('input', 'g1', 60, 80),
      makeComponent('input', 'g2', 60, 210),
      makeComponent('and', 'g3', 310, 145),
      makeComponent('output', 'g4', 560, 145),
    ];
    const next = {
      components,
      wires: [
        { from: 'g1', to: 'g3' },
        { from: 'g2', to: 'g3' },
        { from: 'g3', to: 'g4' },
      ],
      nextId: 5,
    };
    commit(next);
    setSelected([]);
    setProjectName('Sample AND circuit');
  };

  const connectSelected = () => {
    if (selected.length !== 2) return;
    const first = state.components.find(component => component.id === selected[0]);
    const second = state.components.find(component => component.id === selected[1]);
    if (!first || !second) return;
    const source = first.type === 'output' ? second : first;
    const target = source.id === first.id ? second : first;
    if (source.type === 'output' || target.type === 'input') return;
    if (state.wires.some(wire => wire.from === source.id && wire.to === target.id)) return;

    const targetInputs = state.wires.filter(w => w.to === target.id).length;
    const maxInputs = ['and', 'or', 'xor', 'nand', 'nor'].includes(target.type) ? 2 : 1;
    if (targetInputs >= maxInputs) return;

    commit({ ...state, wires: [...state.wires, { from: source.id, to: target.id }] });
    setSelected([target.id]);
  };

  const removeSelected = () => {
    if (!selected.length) return;
    const selectedSet = new Set(selected);
    commit({
      ...state,
      components: state.components.filter(component => !selectedSet.has(component.id)),
      wires: state.wires.filter(wire => !selectedSet.has(wire.from) && !selectedSet.has(wire.to)),
    });
    setSelected([]);
  };

  const toggleSwitch = (id) => {
    commit({
      ...state,
      components: state.components.map(component => (
        component.id === id ? { ...component, value: !component.value } : component
      )),
    });
  };

  const toggleSelected = (id, multi) => {
    setSelected(current => {
      if (!multi) return current.includes(id) ? [] : [id];
      if (current.includes(id)) return current.filter(item => item !== id);
      return [...current, id].slice(-2);
    });
  };

  const onPointerMove = (event) => {
    if (!boardRef.current) return;
    if (!drag && !wireDrag) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(8, event.clientX - rect.left);
    const y = Math.max(8, event.clientY - rect.top);

    if (wireDrag) {
      setWireDrag(current => ({ ...current, toX: x, toY: y }));
      return;
    }

    if (drag) {
      const dragX = Math.max(8, x - drag.offsetX);
      const dragY = Math.max(8, y - drag.offsetY);
      setState(current => ({
        ...current,
        components: current.components.map(component => (
          component.id === drag.id ? { ...component, x: dragX, y: dragY } : component
        )),
      }));
    }
  };

  const handlePointerUp = (event) => {
    if (event.currentTarget && event.currentTarget.releasePointerCapture) {
      try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (e) {}
    }
    if (wireDrag) {
      if (boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const dropX = event.clientX - rect.left;
        const dropY = event.clientY - rect.top;

        let bestTarget = null;
        let bestDist = Infinity;

        const wireIndices = new Map();
        for (const wire of state.wires) {
           const count = wireIndices.get(wire.to) || 0;
           wireIndices.set(wire.to, count + 1);
        }

        for (const component of state.components) {
          if (component.id === wireDrag.fromId || component.type === 'input') continue;

          const maxInputs = hasTwoInputs(component.type) ? 2 : 1;
          const currentInputs = wireIndices.get(component.id) || 0;
          if (currentInputs >= maxInputs) continue;

          const target = targetPoint(component, currentInputs);
          const dist = Math.hypot(target.x - dropX, target.y - dropY);

          if (dist < 30 && dist < bestDist) {
            bestDist = dist;
            bestTarget = component;
          }
        }

        if (bestTarget) {
          const exists = state.wires.some(w => w.from === wireDrag.fromId && w.to === bestTarget.id);
          if (!exists) {
            const next = { ...state, wires: [...state.wires, { from: wireDrag.fromId, to: bestTarget.id }] };
            commit(next);
          }
        }
      }
      setWireDrag(null);
    }

    if (drag) {
      const lastState = history[historyIndex];
      const currentComp = state.components.find(component => component.id === drag.id);
      const lastComp = lastState?.components.find(component => component.id === drag.id);
      if (currentComp && lastComp && (currentComp.x !== lastComp.x || currentComp.y !== lastComp.y)) {
        commit(state);
      }
      setDrag(null);
    }
  };

  const saveProject = async () => {
    const name = await prompt({ title: 'Project name', defaultValue: projectName || 'Untitled circuit', confirmLabel: 'Save' });
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const all = readProjects();
    if (all[trimmed]) {
      const ok = await confirm({ title: 'Overwrite project?', body: `A project named "${trimmed}" already exists. Overwrite?`, confirmLabel: 'Overwrite', danger: true });
      if (!ok) return;
    }
    all[trimmed] = state;
    if (writeProjects(all)) setProjectName(trimmed);
  };

  const openProject = (name) => {
    const all = readProjects();
    if (!all[name]) return;
    const next = all[name];
    setState(next);
    setHistory([next]);
    setHistoryIndex(0);
    setProjectName(name);
    setSelected([]);
    setProjectOpen(false);
  };

  const deleteProject = async (name) => {
    const ok = await confirm({ title: 'Delete project?', body: `Are you sure you want to delete "${name}"?`, confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const all = readProjects();
    delete all[name];
    writeProjects(all);
    setProjectOpen(false);
    window.setTimeout(() => setProjectOpen(true), 0);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'circuit'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#071427';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 4;
    for (const wire of state.wires) {
      const from = state.components.find(component => component.id === wire.from);
      const to = state.components.find(component => component.id === wire.to);
      if (!from || !to) continue;
      const a = sourcePoint(from);
      const b = targetPoint(to);
      ctx.strokeStyle = values.get(from.id)?.out ? '#35d399' : 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(a.x + 20, a.y + 20);
      ctx.bezierCurveTo(a.x + 110, a.y + 20, b.x - 80, b.y + 20, b.x + 20, b.y + 20);
      ctx.stroke();
    }
    for (const component of state.components) {
      const live = values.get(component.id)?.out;
      ctx.fillStyle = live ? '#0d3d33' : '#102033';
      ctx.strokeStyle = live ? '#35d399' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(component.x + 20, component.y + 20, 170, 88, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#eaf7fb';
      ctx.font = '24px Georgia';
      ctx.fillText(component.label, component.x + 40, component.y + 70);
    }
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${projectName || 'circuit'}.png`;
    link.click();
  };

  return (
    <div className="fade-in space-y-6">
      {confirmDialogEl}
      {promptDialogEl}
      <section className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50 mb-2">Circuit Maker</div>
          <h1 className="font-display text-5xl font-medium tracking-tight leading-none">Logic Workspace</h1>
          <p className="font-display text-xl opacity-65 mt-4 max-w-2xl">
            Build small logic circuits from switches, gates, wires, and LEDs.
          </p>
        </div>
        <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-50">{projectName}</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-3">
          <div className="card" id="palette">
            <div className="font-mono text-[0.65rem] tracking-widest uppercase opacity-60 mb-3">Palette</div>
            <div className="grid grid-cols-2 gap-2">
              {GATE_TYPES.map(([type, label]) => (
                <button key={type} onClick={() => addComponent(type)} className="btn-ghost justify-start px-3 py-2">
                  <Plus size={12} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card space-y-2">
            <button onClick={connectSelected} disabled={selected.length !== 2} className="btn-primary w-full"><Zap size={14} /> Connect</button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={undo} disabled={historyIndex <= 0} className="btn-ghost"><Undo2 size={13} /> Undo</button>
              <button onClick={redo} disabled={historyIndex >= history.length - 1} className="btn-ghost"><RotateCcw size={13} /> Redo</button>
              <button id="sampleBtn" onClick={sample} className="btn-ghost"><Zap size={13} /> Sample</button>
              <button onClick={removeSelected} disabled={!selected.length} className="btn-ghost"><Trash2 size={13} /> Delete</button>
              <button onClick={saveProject} className="btn-ghost"><Save size={13} /> Save</button>
              <button onClick={() => setProjectOpen(true)} className="btn-ghost"><FolderOpen size={13} /> Open</button>
              <button onClick={exportJson} className="btn-ghost"><Download size={13} /> JSON</button>
              <button id="exportPng" onClick={exportPng} className="btn-ghost"><Download size={13} /> PNG</button>
            </div>
            <button onClick={clear} className="btn-danger w-full"><Trash2 size={13} /> Clear</button>
          </div>

          <div className="border hairline p-4 font-mono text-[0.65rem] tracking-wide opacity-60 leading-relaxed">
            Click a component to select it. Shift-click a second component, then connect. Drag components to arrange the circuit.
          </div>
        </aside>

        <div
          ref={boardRef}
          className="relative border hairline min-h-[620px] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, #071427, #041021)', touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" style={{ zIndex: 0 }}>
            {(() => {
              const wireIndices3 = new Map();
              const paths = state.wires.map((wire, index) => {
                const from = state.components.find(component => component.id === wire.from);
                const to = state.components.find(component => component.id === wire.to);
                if (!from || !to) return null;

                const count = wireIndices3.get(to.id) || 0;
                wireIndices3.set(to.id, count + 1);

                const a = sourcePoint(from);
                const isTwo = ['and', 'or', 'xor', 'nand', 'nor'].includes(to.type);
                const targetY = isTwo ? (count === 0 ? to.y + 28 : to.y + 60) : to.y + 44;
                const b = { x: to.x, y: targetY };
                const live = values.get(from.id)?.out;
                const wireId = `${wire.from}-${wire.to}`;
                const isSelected = selected.includes(wireId);
                return (
                  <path
                    key={`${wireId}-${index}`}
                    d={`M ${a.x} ${a.y} C ${a.x + 80} ${a.y}, ${b.x - 80} ${b.y}, ${b.x} ${b.y}`}
                    fill="none"
                    stroke={isSelected ? '#f8d35c' : live ? '#35d399' : 'rgba(255,255,255,0.28)'}
                    strokeWidth="8"
                    strokeLinecap="round"
                    style={{ pointerEvents: 'auto', cursor: 'pointer', transition: 'stroke 0.2s' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelected(wireId, e.shiftKey);
                    }}
                  />
                );
              });

              if (wireDrag) {
                 paths.push(
                   <path
                     key="wire-drag"
                     d={`M ${wireDrag.startX} ${wireDrag.startY} C ${wireDrag.startX + 80} ${wireDrag.startY}, ${wireDrag.toX - 80} ${wireDrag.toY}, ${wireDrag.toX} ${wireDrag.toY}`}
                     fill="none"
                     stroke="rgba(255,255,255,0.4)"
                     strokeWidth="3"
                     strokeLinecap="round"
                     strokeDasharray="6 6"
                   />
                 );
              }

              return paths;
            })()}
          </svg>

          {state.components.map(component => (
            <CircuitNode
              key={component.id}
              component={component}
              selected={selected.includes(component.id)}
              value={values.get(component.id)}
              onSelect={(event) => toggleSelected(component.id, event.shiftKey)}
              onDragStart={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setDrag({ id: component.id, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top });
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onToggle={() => toggleSwitch(component.id)}
              onWireStart={(event) => {
                event.stopPropagation();
                const start = sourcePoint(component);
                setWireDrag({
                   fromId: component.id,
                   startX: start.x,
                   startY: start.y,
                   toX: start.x,
                   toY: start.y,
                });
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
            />
          ))}

          {!state.components.length && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-white/55 px-8 pointer-events-none">
              <div>
                <div className="font-display text-4xl mb-3">Start with a switch</div>
                <div className="font-mono text-[0.7rem] tracking-widest uppercase">Add gates from the palette</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {projectOpen && (
        <div className="fixed inset-0 bg-black/55 z-50 flex items-center justify-center p-4" onMouseDown={() => setProjectOpen(false)}>
          <div className="w-full max-w-md border hairline p-5" id="projectList" style={{ background: 'var(--paper-tint)' }} onMouseDown={event => event.stopPropagation()}>
            <div className="font-display text-2xl mb-3">Open Project</div>
            <div className="space-y-2 max-h-[360px] overflow-auto scrollbar-thin">
              {Object.keys(projects).length === 0 && <div className="font-mono text-xs opacity-50 py-6 text-center">No saved projects yet.</div>}
              {Object.keys(projects).sort().map(name => (
                <div key={name} className="flex items-center justify-between border hairline px-3 py-2 gap-3">
                  <button onClick={() => openProject(name)} className="font-display text-lg truncate text-left flex-1">{name}</button>
                  <button onClick={() => deleteProject(name)} className="opacity-50 hover:opacity-100" aria-label={`Delete ${name}`}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={() => setProjectOpen(false)} className="btn-primary w-full mt-4">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CircuitNode({ component, selected, value, onSelect, onDragStart, onToggle, onWireStart }) {
  const live = !!value?.out;
  return (
    <div
      className="absolute border p-3 select-none"
      style={{
        left: component.x,
        top: component.y,
        width: 170,
        minHeight: 88,
        background: live ? 'rgba(53, 211, 153, 0.18)' : 'rgba(255,255,255,0.06)',
        borderColor: selected ? '#f8d35c' : live ? '#35d399' : 'rgba(255,255,255,0.18)',
        color: '#eaf7fb',
        boxShadow: selected ? '0 0 0 2px rgba(248, 211, 92, 0.55)' : '0 18px 40px rgba(0,0,0,0.28)',
        cursor: 'grab',
      }}
      onClick={onSelect}
      onPointerDown={onDragStart}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-xl leading-tight">{component.label}</div>
          <div className="font-mono text-[0.55rem] tracking-widest uppercase opacity-55">{component.type}</div>
        </div>
        <div className="font-mono text-[0.58rem] tracking-widest uppercase" style={{ color: live ? '#35d399' : 'rgba(255,255,255,0.45)' }}>
          {live ? 'On' : 'Off'}
        </div>
      </div>

      {component.type === 'input' && (
        <button type="button" onPointerDown={event => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onToggle(); }} className="btn-ghost mt-3 w-full text-white border-white/20">
          Toggle {component.value ? 'Off' : 'On'}
        </button>
      )}

      {component.type === 'output' && (
        <div className="mt-3 flex items-center gap-2">
          <span className="block rounded-full" style={{ width: 22, height: 22, background: live ? component.color : 'rgba(255,255,255,0.16)', boxShadow: live ? `0 0 18px ${component.color}` : 'none' }} />
          <span className="font-mono text-[0.6rem] tracking-widest uppercase opacity-60">LED</span>
        </div>
      )}

      {component.type !== 'input' && (
        ['and', 'or', 'xor', 'nand', 'nor'].includes(component.type) ? (
          <>
            <span className="absolute left-[-7px] top-[22px] w-3 h-3 rounded-full bg-white/70" />
            <span className="absolute left-[-7px] top-[54px] w-3 h-3 rounded-full bg-white/70" />
          </>
        ) : (
          <span className="absolute left-[-7px] top-[38px] w-3 h-3 rounded-full bg-white/70" />
        )
      )}
      {component.type !== 'output' && (
        <span
          className="absolute right-[-7px] top-[38px] w-3 h-3 rounded-full"
          style={{ background: live ? '#35d399' : 'rgba(255,255,255,0.7)', cursor: 'crosshair', pointerEvents: 'auto' }}
          onPointerDown={onWireStart}
        />
      )}
    </div>
  );
}
