/* Team colour tabs + the 12 Devu mascots of that colour */
import { TEAMS, TEAM_KEYS, mascot } from '../../lib/constants';

export function TeamTabs({ team, onTeam, style, pills }) {
  return (
    <div className={`team-tabs${pills ? ' pills' : ''}`} role="tablist" aria-label="Mascot color" style={style}>
      {TEAM_KEYS.map((k) => (
        <button key={k} type="button" role="tab" className={`t-${k}`} style={{ '--c': TEAMS[k].solid }} aria-selected={team === k} onClick={() => onTeam(k)}><i />{TEAMS[k].name}{pills && team === k ? ' · 12' : ''}</button>
      ))}
    </div>
  );
}

export function MascotGrid({ team, idx, onPick, six }) {
  return (
    <div className={`m-grid${six ? ' six' : ''}`}>
      {Array.from({ length: 12 }, (_, i) => (
        <button key={i} type="button" className={`c-${team}`} aria-pressed={idx === i} aria-label={`${TEAMS[team].name} mascot ${i + 1}`} onClick={() => onPick(i)}>
          <img src={mascot(team, i)} alt="" />
        </button>
      ))}
    </div>
  );
}
