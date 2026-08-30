"use client";

import { useState } from "react";
import { buildCallSheet } from "@/lib/call-sheet";
import { useStudio } from "@/lib/studio-store";
import {
  SHOT_STATUSES,
  STUDIO_TABS,
  formatLabel,
  shotStatusLabel,
  tabLabel,
  type ShotStatus,
  type StudioTab,
} from "@/lib/types";
import { AgentDock } from "./AgentDock";
import { PixelFrameView } from "./PixelFrameView";
import { WebMCPBridge } from "./WebMCPBridge";

export function StudioApp() {
  const api = useStudio();
  const { active, snapshot } = api;

  return (
    <div className="studio">
      <div className="grain" aria-hidden />
      <header className="mast">
        <div className="brand">
          <span className="mark">PFS</span>
          <div>
            <p className="wordmark">Pixel Film Studio</p>
            <p className="tag">Humans on the floor. Agents on the tools.</p>
          </div>
        </div>
        <div className="mast-mid">
          <p className="now-shooting">Now shooting</p>
          <h1>{active?.title ?? "No production"}</h1>
        </div>
        <WebMCPBridge />
      </header>

      <nav className="desks" aria-label="Studio desks">
        {STUDIO_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            data-active={snapshot.tab === tab}
            onClick={() => api.setTab(tab)}
          >
            {tabLabel(tab)}
          </button>
        ))}
      </nav>

      <div className="floor-grid">
        <aside className="slate">
          <p className="kicker">Slate</p>
          <ul className="prod-list">
            {snapshot.productions.map((production) => (
              <li key={production.id}>
                <button
                  type="button"
                  data-active={production.id === snapshot.activeId}
                  onClick={() => api.openProduction(production.id)}
                >
                  <strong>{production.title}</strong>
                  <span>
                    {formatLabel(production.format)} · {production.shots.length} shots
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <NewProduction onCreate={(title) => api.createProduction({ title })} />
          <p className="kicker">Cast</p>
          <ul className="cast">
            {active?.characters.map((character) => (
              <li key={character.id}>
                <span className="swatch" style={{ background: character.palette }} />
                <div>
                  <strong>{character.name}</strong>
                  <span>{character.role}</span>
                </div>
              </li>
            ))}
          </ul>
          <CastForm
            onAdd={(name, role) => api.addCharacter({ name, role })}
          />
        </aside>

        <main className="desk">
          {active ? (
            <Desk tab={snapshot.tab} />
          ) : (
            <p className="muted">Create a production to open the floor.</p>
          )}
        </main>

        <AgentDock />
      </div>
    </div>
  );
}

function Desk({ tab }: { tab: StudioTab }) {
  switch (tab) {
    case "floor":
      return <FloorDesk />;
    case "script":
      return <ScriptDesk />;
    case "board":
      return <BoardDesk />;
    case "shots":
      return <ShotsDesk />;
    case "timeline":
      return <TimelineDesk />;
    case "dailies":
      return <DailiesDesk />;
    default: {
      const exhaustive: never = tab;
      throw new Error(`Unhandled desk: ${String(exhaustive)}`);
    }
  }
}

function FloorDesk() {
  const { active } = useStudio();
  if (!active) {
    return null;
  }
  const sheet = buildCallSheet(active);
  const remaining = Math.max(
    0,
    active.targetMinutes * 60 - sheet.totals.remainingSec,
  );

  return (
    <section className="panel">
      <p className="kicker">Floor</p>
      <h2>{active.title}</h2>
      <p className="logline">{active.logline}</p>
      <dl className="stats">
        <div>
          <dt>Genre</dt>
          <dd>{active.genre}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{formatLabel(active.format)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{active.targetMinutes} min</dd>
        </div>
        <div>
          <dt>In the can</dt>
          <dd>
            {sheet.totals.inCan}/{sheet.totals.shots}
          </dd>
        </div>
        <div>
          <dt>Frames painted</dt>
          <dd>
            {sheet.totals.withFrames}/{sheet.totals.shots}
          </dd>
        </div>
        <div>
          <dt>Locked runtime</dt>
          <dd>{remaining}s covered</dd>
        </div>
      </dl>
      <div className="note-list">
        {active.notes.map((note) => (
          <blockquote key={note.id} data-author={note.author}>
            <p>{note.body}</p>
            <footer>
              {note.author} · {new Date(note.at).toLocaleString()}
            </footer>
          </blockquote>
        ))}
      </div>
      <NoteForm />
    </section>
  );
}

function ScriptDesk() {
  const { active, updateScript } = useStudio();
  if (!active) {
    return null;
  }
  return (
    <section className="panel">
      <p className="kicker">Script desk</p>
      <h2>Screenplay</h2>
      <textarea
        className="script"
        value={active.script}
        onChange={(event) => updateScript(event.target.value)}
        spellCheck={false}
      />
    </section>
  );
}

function BoardDesk() {
  const api = useStudio();
  const { active } = api;
  if (!active) {
    return null;
  }
  return (
    <section className="panel">
      <p className="kicker">Storyboard</p>
      <h2>32×18 minimum picture</h2>
      <p className="lede">
        If a face still reads on the black, the frame is legal. Agents paint
        with <code>paint_pixel_frame</code>.
      </p>
      <div className="board">
        {active.shots.map((shot) => (
          <article key={shot.id} className="cell">
            {shot.frame ? (
              <PixelFrameView
                frame={shot.frame}
                label={`${shot.number} ${shot.title}`}
              />
            ) : (
              <button
                type="button"
                className="empty-frame"
                onClick={() => api.paintShotFrame(shot.id)}
              >
                Paint {shot.number}
              </button>
            )}
            <p>
              <strong>{shot.number}</strong> {shot.title}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShotsDesk() {
  const api = useStudio();
  const { active } = api;
  if (!active) {
    return null;
  }
  return (
    <section className="panel">
      <p className="kicker">Shot list</p>
      <h2>Coverage</h2>
      <table className="shots">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Status</th>
            <th>Lens</th>
            <th>Sec</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {active.shots.map((shot) => (
            <tr key={shot.id}>
              <td>{shot.number}</td>
              <td>
                <strong>{shot.title}</strong>
                <span className="muted">{shot.description}</span>
              </td>
              <td>
                <select
                  value={shot.status}
                  onChange={(event) =>
                    api.setShotStatus(shot.id, event.target.value as ShotStatus)
                  }
                >
                  {SHOT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {shotStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </td>
              <td>{shot.lens}</td>
              <td>{shot.durationSec}</td>
              <td>
                <button type="button" onClick={() => api.paintShotFrame(shot.id)}>
                  Paint
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ShotForm />
    </section>
  );
}

function TimelineDesk() {
  const { active } = useStudio();
  if (!active) {
    return null;
  }
  const total = active.shots.reduce((sum, shot) => sum + shot.durationSec, 0) || 1;
  return (
    <section className="panel">
      <p className="kicker">Timeline</p>
      <h2>Picture cut (duration)</h2>
      <div className="timeline">
        {active.shots.map((shot) => (
          <div
            key={shot.id}
            className="clip"
            data-status={shot.status}
            style={{ flex: shot.durationSec / total }}
            title={`${shot.number} ${shot.title}`}
          >
            <span>
              {shot.number}
              <em>{shot.durationSec}s</em>
            </span>
          </div>
        ))}
      </div>
      <ol className="scene-list">
        {active.scenes.map((scene) => (
          <li key={scene.id}>
            <strong>
              {scene.number}. {scene.heading}
            </strong>
            <p>{scene.synopsis}</p>
          </li>
        ))}
      </ol>
      <SceneForm />
    </section>
  );
}

function DailiesDesk() {
  const { active } = useStudio();
  if (!active) {
    return null;
  }
  const dailies = active.shots.filter(
    (shot) => shot.status === "in_can" || shot.status === "locked",
  );
  return (
    <section className="panel">
      <p className="kicker">Dailies</p>
      <h2>In the can</h2>
      <div className="board">
        {dailies.length === 0 ? (
          <p className="muted">Nothing in the can yet.</p>
        ) : (
          dailies.map((shot) => (
            <article key={shot.id} className="cell">
              {shot.frame ? (
                <PixelFrameView frame={shot.frame} label={shot.number} />
              ) : (
                <div className="empty-frame">No frame</div>
              )}
              <p>
                <strong>{shot.number}</strong> {shot.title} ·{" "}
                {shotStatusLabel(shot.status)}
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NewProduction({ onCreate }: { onCreate: (title: string) => void }) {
  const [title, setTitle] = useState("");
  return (
    <form
      className="mini-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) {
          return;
        }
        onCreate(title.trim());
        setTitle("");
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="New production title"
      />
      <button type="submit">Open</button>
    </form>
  );
}

function CastForm({
  onAdd,
}: {
  onAdd: (name: string, role: string) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  return (
    <form
      className="mini-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) {
          return;
        }
        onAdd(name.trim(), role.trim());
        setName("");
        setRole("");
      }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
      />
      <input
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="Role"
      />
      <button type="submit">Cast</button>
    </form>
  );
}

function NoteForm() {
  const { addNote } = useStudio();
  const [body, setBody] = useState("");
  return (
    <form
      className="mini-form stacked"
      onSubmit={(event) => {
        event.preventDefault();
        if (!body.trim()) {
          return;
        }
        addNote(body.trim(), "human");
        setBody("");
      }}
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Pin a floor note"
        rows={3}
      />
      <button type="submit">Pin note</button>
    </form>
  );
}

function ShotForm() {
  const { active, addShot } = useStudio();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  if (!active) {
    return null;
  }
  return (
    <form
      className="mini-form stacked"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) {
          return;
        }
        addShot({ title: title.trim(), description: description.trim() });
        setTitle("");
        setDescription("");
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Shot title"
      />
      <input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What the camera sees"
      />
      <button type="submit">Add shot</button>
    </form>
  );
}

function SceneForm() {
  const { addScene } = useStudio();
  const [heading, setHeading] = useState("");
  const [synopsis, setSynopsis] = useState("");
  return (
    <form
      className="mini-form stacked"
      onSubmit={(event) => {
        event.preventDefault();
        if (!heading.trim()) {
          return;
        }
        addScene({ heading: heading.trim(), synopsis: synopsis.trim() });
        setHeading("");
        setSynopsis("");
      }}
    >
      <input
        value={heading}
        onChange={(event) => setHeading(event.target.value)}
        placeholder="EXT. LOCATION — NIGHT"
      />
      <input
        value={synopsis}
        onChange={(event) => setSynopsis(event.target.value)}
        placeholder="Synopsis"
      />
      <button type="submit">Add scene</button>
    </form>
  );
}
