import React, { useState, useEffect, useCallback } from 'react';
import { CustomSocket } from '../../types/socket.types';

// Define more specific types for game state for better clarity
interface Player {
  id: string;
  name: string;
  role: string | null;
  isAlive: boolean;
  votesFor?: number;
}

interface GameMessage {
  id: string;
  text: string;
  timestamp: string;
  sender: string;
}

interface GameState {
  id: string;
  hostId: string;
  players: Player[];
  phase: string;
  // roles: { forraedere: string[]; lojale: string[] }; // Admin will see this in adminFullGameState
  totalPoints: number;
  messages: GameMessage[];
  tasks?: Record<string, string>;
  submissions?: Record<string, string>;
  eliminatedPlayer?: { id?: string; name?: string; role?: string; tiedVote?: boolean; noMajority?: boolean; playersInvolved?: string[] } | null;
  killedPlayer?: { id?: string; name?: string; role?: string; noKill?: boolean } | null;
  winner?: string | null;
  reason?: string | null;
  myRole?: string; // Player's own role
  started?: boolean; // Custom flag, true if roles are assigned
}

// For admin, who sees everything
interface AdminFullGameState extends GameState {
    roles: { forraedere: string[]; lojale: string[] };
    votes?: Record<string, string>; // voterId: votedPlayerId
}


interface ForraederGameProps {
  sessionId: string; // Will serve as gameId for MVP via HTTP
  socket: CustomSocket | null; // Keep for potential future socket use
  playerName: string;
  isHost: boolean;
}

const API_BASE_URL = '/api/forraeder'; // Defined in server/index.js and server/forraeder/routes.js

const FORRAEDER_PHASES_DISPLAY: Record<string, string> = {
  setup: 'Oppsett (Venter på spillere)',
  oppdrag: 'Dagfase: Oppdrag',
  diskusjon: 'Diskusjonsfase',
  avstemning: 'Avstemningsfase',
  natt: 'Nattfase',
  avsluttet: 'Spill Avsluttet',
};


const ForraederGame: React.FC<ForraederGameProps> = ({ sessionId, socket, playerName, isHost }) => {
  const [gameId, setGameId] = useState<string | null>(sessionId); // Use sessionId as gameId
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  // Combined state for player and base admin view
  const [currentGameState, setCurrentGameState] = useState<GameState | null>(null);
  // Detailed state for admin view (includes all roles, etc.)
  const [adminFullGameState, setAdminFullGameState] = useState<AdminFullGameState | null>(null);

  const [adminMessage, setAdminMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false); // General loading for actions
  const [isPolling, setIsPolling] = useState<boolean>(false); // Specific for background polling
  const [error, setError] = useState<string | null>(null);

  // For admin to add new players
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerId, setNewPlayerId] = useState<string>('');

  // Player action states
  const [selectedVoteTarget, setSelectedVoteTarget] = useState<string | null>(null);
  const [selectedKillTarget, setSelectedKillTarget] = useState<string | null>(null);
  const [hasVotedThisRound, setHasVotedThisRound] = useState<boolean>(false);
  const [traitorActionMadeThisNight, setTraitorActionMadeThisNight] = useState<boolean>(false);


  useEffect(() => {
    setCurrentPlayerId(playerName || `player-${Math.random().toString(36).substring(2, 7)}`);
  }, [playerName]);

  useEffect(() => {
    // Reset vote/action status when phase changes
    setHasVotedThisRound(false);
    setSelectedVoteTarget(null);
    setTraitorActionMadeThisNight(false);
    setSelectedKillTarget(null);
  }, [currentGameState?.phase])


  const fetchPlayerGameState = useCallback(async (isPoll = false) => {
    if (!gameId || !currentPlayerId) return;
    if (!isPoll) setIsLoading(true); else setIsPolling(true);
    if (!isPoll) setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/state/${currentPlayerId}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch player game state: ${response.status}`);
      }
      const data: GameState = await response.json();
      setCurrentGameState(data);
      if(data.phase === "setup" && isHost && !adminFullGameState && !isPoll) {
        fetchAdminGameState(false);
      }
    } catch (err: any) {
      if (!isPoll) setError(err.message);
      console.error("Error fetching player game state:", err);
    } finally {
      if (!isPoll) setIsLoading(false); else setIsPolling(false);
    }
  }, [gameId, currentPlayerId, isHost, adminFullGameState]); // Added adminFullGameState

  const fetchAdminGameState = useCallback(async (isPoll = false) => {
    if (!gameId || !isHost) return;
    if (!isPoll) setIsLoading(true); else setIsPolling(true);
    if (!isPoll) setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/admin/state`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to fetch admin game state: ${response.status}`);
      }
      const data: AdminFullGameState = await response.json();
      setAdminFullGameState(data);
      setCurrentGameState(data);
    } catch (err: any) {
      if (!isPoll) setError(err.message);
      console.error("Error fetching admin game state:", err);
    } finally {
      if (!isPoll) setIsLoading(false); else setIsPolling(false);
    }
  }, [gameId, isHost]);

  useEffect(() => {
    // Initial fetch
    if (isHost) {
      fetchAdminGameState(false); // Initial fetch for admin
    } else {
      fetchPlayerGameState(false); // Initial fetch for player
    }

    const intervalId = setInterval(() => {
      if (isHost) {
        fetchAdminGameState(true); // Subsequent fetches are polls
      } else {
        fetchPlayerGameState(true); // Subsequent fetches are polls
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isHost, fetchAdminGameState, fetchPlayerGameState]); // Dependencies for initial setup


  const handleCreateGame = async () => {
    if (!isHost || !currentPlayerId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentPlayerId, playerName: playerName }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to create game: ${response.status}`);
      }
      const data = await response.json();
      setGameId(data.gameId); // Update gameId state
      // setCurrentGameState(data.initialGameState); // This will be GameState
      setAdminFullGameState(data.initialGameState); // This will be AdminFullGameState
      setCurrentGameState(data.initialGameState); // Also set the player view for admin
      console.log('Game created:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPlayer = async () => {
    if (!isHost || !gameId || !newPlayerName.trim() || !newPlayerId.trim()) {
        setError("Player Name and a unique Player ID are required.");
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const response = await fetch(`${API_BASE_URL}/${gameId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId: newPlayerId, playerName: newPlayerName }),
        });
        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `Failed to add player: ${response.status}`);
        }
        const data = await response.json();
        setAdminFullGameState(data.gameState);
        setCurrentGameState(data.gameState);
        setNewPlayerName('');
        setNewPlayerId('');
        console.log('Player added:', data);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setIsLoading(false);
    }
  };


  const handleStartGame = async () => {
    if (!isHost || !gameId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/start`, { method: 'POST' });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to start game: ${response.status}`);
      }
      const data = await response.json();
      setAdminFullGameState(data.gameState);
      setCurrentGameState(data.gameState);
      console.log('Game started:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPhase = async (phase: string) => {
    if (!isHost || !gameId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/phase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to set phase: ${response.status}`);
      }
      const data = await response.json();
      setAdminFullGameState(data.gameState);
      setCurrentGameState(data.gameState); // Update general view as well
      console.log(`Phase set to ${phase}:`, data);
       // If game ended, display winner
      if (data.winCondition?.gameOver) {
        alert(`${data.winCondition.winner} wins! Reason: ${data.winCondition.reason}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTallyVotes = async () => {
    if (!isHost || !gameId ) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/tally-votes`, { method: 'POST'});
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to tally votes: ${response.status}`);
      }
      const data = await response.json();
      setAdminFullGameState(data.gameState);
      setCurrentGameState(data.gameState);
      console.log('Votes tallied:', data);
      if (data.gameState.eliminatedPlayer?.name) {
        alert(`${data.gameState.eliminatedPlayer.name} (Rolle: ${data.gameState.eliminatedPlayer.role}) ble eliminert!`);
      } else if (data.gameState.eliminatedPlayer?.tiedVote) {
        alert("Uavgjort i avstemningen! Ingen ble eliminert denne runden.");
      } else if (data.gameState.eliminatedPlayer?.noMajority) {
        alert("Ingen majoritet i avstemningen. Ingen ble eliminert.");
      }
       // If game ended, display winner
      if (data.winCondition?.gameOver) {
        alert(`${data.winCondition.winner} wins! Reason: ${data.winCondition.reason}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendAdminMessage = async () => {
    if (!isHost || !gameId || !adminMessage.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/admin-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: adminMessage }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to send message: ${response.status}`);
      }
      const data = await response.json();
      setAdminFullGameState(data.gameState); // Assuming this returns the full state
      setCurrentGameState(data.gameState);
      setAdminMessage('');
      console.log('Admin message sent:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Use currentGameState for player view, adminFullGameState for admin's detailed view
  const displayState = isHost ? adminFullGameState : currentGameState;

  if (isLoading && !displayState) { // Only show full page loading if no state is available yet
    return <div>Laster Forræder-spill...</div>;
  }

  if (error) {
    return <div style={{color: 'red'}}>Error: {error} <button onClick={() => isHost ? fetchAdminGameState() : fetchPlayerGameState()}>Prøv igjen</button></div>;
  }

  if (!gameId || !currentPlayerId) {
    return <div>Laster Forræder-spill... (Mangler gameId eller playerId)</div>;
  }

  if (!displayState) {
      if (isHost) {
          return (
              <div className="forraeder-game">
                  <h1>Forræder på Hytta - Admin</h1>
                  <button onClick={handleCreateGame} disabled={isLoading}>Opprett Nytt Spill</button>
                  {isLoading && <p>Jobber...</p>}
              </div>
          );
      }
      return <div>Venter på at spillet skal starte eller lastes...</div>;
  }

  const gamePhase = displayState.phase || 'ukjent';
  const gameStarted = adminFullGameState ? (adminFullGameState.phase !== 'setup' || (adminFullGameState.players.length > 0 && adminFullGameState.players.some(p => p.role))) : (currentGameState?.started || false);

  const amIAlive = displayState.players.find(p => p.id === currentPlayerId)?.isAlive;
  const myCurrentRole = displayState.myRole || (isHost && adminFullGameState?.players.find(p=>p.id === currentPlayerId)?.role);

  const handlePlayerVote = async () => {
    if (!gameId || !currentPlayerId || !selectedVoteTarget || hasVotedThisRound) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voterId: currentPlayerId, votedPlayerId: selectedVoteTarget }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to submit vote: ${response.status}`);
      }
      const data = await response.json();
      // Update local state to reflect vote, or rely on next poll
      if (isHost) setAdminFullGameState(data.gameState);
      else setCurrentGameState(data.gameState);
      setHasVotedThisRound(true);
      alert("Stemme avgitt!");
      console.log('Vote submitted:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTraitorAction = async () => {
    if (!gameId || !currentPlayerId || !selectedKillTarget || traitorActionMadeThisNight || myCurrentRole !== 'Forræder') return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/${gameId}/traitor-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traitorId: currentPlayerId, targetPlayerId: selectedKillTarget }),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to submit traitor action: ${response.status}`);
      }
      const data = await response.json();
      if (isHost) setAdminFullGameState(data.gameState);
      else setCurrentGameState(data.gameState);
      setTraitorActionMadeThisNight(true);
      alert("Forræderhandling utført!");
      console.log('Traitor action submitted:', data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="forraeder-game" style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h1>Forræder på Hytta</h1>
      <p>Spill ID: {gameId} (Del denne med spillere for manuell tilkobling om nødvendig)</p>
      <p>Du er: {playerName} ({currentPlayerId}) {amIAlive ? "(Levende)" : "(Ute av spillet)"}</p>
      {(isLoading && !isPolling) && <p><i>Laster...</i></p>}
      {isPolling && <p style={{fontSize: '0.8em', color: 'gray'}}><i>Sjekker etter oppdateringer...</i></p>}


      {isHost && adminFullGameState && (
        <div className="admin-controls" style={{ border: '2px solid blue', padding: '15px', marginBottom: '20px' }}>
          <h2>Admin Panel</h2>
          <p>Nåværende Fase: <strong>{FORRAEDER_PHASES_DISPLAY[gamePhase] || gamePhase}</strong></p>

          {!gameStarted && adminFullGameState.phase === 'setup' && (
            <>
              <div style={{marginBlock: "10px"}}>
                <input
                    type="text"
                    value={newPlayerId}
                    onChange={(e) => setNewPlayerId(e.target.value)}
                    placeholder="Ny Spiller ID (unik)"
                />
                <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Ny Spiller Navn"
                />
                <button onClick={handleAddPlayer} disabled={isLoading}>Legg til Spiller</button>
              </div>
              <button onClick={handleStartGame} disabled={isLoading || adminFullGameState.players.length < 3}>
                Start Spill (Tildel Roller)
              </button>
              {adminFullGameState.players.length < 3 && <p><small>Trenger minst 3 spillere for å starte.</small></p>}
            </>
          )}

          {gameStarted && (
            <>
              <h4>Endre Fase:</h4>
              {Object.entries(FORRAEDER_PHASES_DISPLAY).map(([phaseKey, phaseDisplay]) => (
                <button key={phaseKey} onClick={() => handleSetPhase(phaseKey)} disabled={isLoading || gamePhase === phaseKey || gamePhase === 'avsluttet'}>
                  Sett til {phaseDisplay}
                </button>
              ))}
              <hr/>
              {gamePhase === 'avstemning' && (
                <button onClick={handleTallyVotes} disabled={isLoading}>
                  Tell Stemmer og Eliminer
                </button>
              )}
               {/* Manuell prosessering av natt for admin, hvis /phase ikke gjør det automatisk */}
              {gamePhase === 'natt' && (
                 <button onClick={() => handleSetPhase('oppdrag')} disabled={isLoading}>
                  Start Ny Dag (Prosessér Natt)
                </button>
              )}

              <h4>Send Fellesmelding:</h4>
              <div>
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Skriv fellesmelding her..."
                  style={{width: '80%', padding:'8px'}}
                />
                <button onClick={handleSendAdminMessage} disabled={isLoading}>Send</button>
              </div>
            </>
          )}

          <h4>Spillere (Admin Visning):</h4>
          <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
            {adminFullGameState.players.map(p => (
              <li key={p.id} style={{ color: p.isAlive ? 'black' : 'grey', textDecoration: p.isAlive ? 'none' : 'line-through', marginBottom:'5px' }}>
                {p.name} ({p.id}) - Rolle: {p.role || 'Ikke tildelt'} - Status: {p.isAlive ? 'Levende' : 'Eliminert/Død'}
                {gamePhase === 'avstemning' && p.isAlive && <span> - Stemmer på seg: {p.votesFor || 0}</span>}
              </li>
            ))}
          </ul>
          {adminFullGameState.votes && Object.keys(adminFullGameState.votes).length > 0 && (
            <div>
              <h4>Avgitte Stemmer (Avstemningsfase):</h4>
              <ul>
                {Object.entries(adminFullGameState.votes).map(([voterId, votedId]) => {
                  const voter = adminFullGameState.players.find(p => p.id === voterId);
                  const voted = adminFullGameState.players.find(p => p.id === votedId);
                  return (
                    <li key={voterId}>
                      {voter?.name || voterId} stemte på {voted?.name || votedId}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="player-view" style={{border: '1px solid #ccc', padding: '15px'}}>
        <h2>Din Info</h2>
        <p>Rolle: <strong>{displayState.myRole || (isHost && adminFullGameState?.players.find(p=>p.id === currentPlayerId)?.role) || 'Venter...'}</strong></p>
        <p>Nåværende Fase: <strong>{FORRAEDER_PHASES_DISPLAY[gamePhase] || gamePhase}</strong></p>
        <p>Total Poengpott: {displayState.totalPoints || 0}</p>

        {displayState.eliminatedPlayer && (
          <div style={{color: 'orange', marginTop:'10px'}}>
            <strong>Siste Eliminering:</strong>
            {displayState.eliminatedPlayer.tiedVote ?
              ` Uavgjort! Ingen ble eliminert. Spillere involvert: ${displayState.eliminatedPlayer.playersInvolved?.join(', ')}` :
            displayState.eliminatedPlayer.noMajority ?
              ` Ingen majoritet! Ingen ble eliminert.` :
              ` ${displayState.eliminatedPlayer.name} (Rolle: ${displayState.eliminatedPlayer.role}) ble stemt ut.`
            }
          </div>
        )}
        {displayState.killedPlayer && (
          <div style={{color: 'red', marginTop:'10px'}}>
            <strong>Siste Drap (Natt):</strong>
            {displayState.killedPlayer.noKill ?
              ` Ingen ble drept i natt.` :
              ` ${displayState.killedPlayer.name} (Rolle: ${displayState.killedPlayer.role}) ble drept.`
            }
          </div>
        )}

        {displayState.winner && (
          <div style={{color: 'green', fontWeight: 'bold', fontSize: '1.2em', marginTop:'15px'}}>
            🎉 {displayState.winner} har vunnet! 🎉 <br/>
            {displayState.reason && <small>({displayState.reason})</small>}
          </div>
        )}

        <h3>Meldinger fra Admin:</h3>
        <div className="messages" style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #eee', padding: '10px', marginBottom: '20px' }}>
          {(displayState.messages || []).slice().reverse().map((msg) => ( // Show newest first
            <p key={msg.id}><i><small>{new Date(msg.timestamp).toLocaleTimeString()}</small>:</i> {msg.text}</p>
          ))}
          {(displayState.messages || []).length === 0 && <p><small>Ingen meldinger ennå.</small></p>}
        </div>

        {/* Player actions specific to phase and role */}
        {amIAlive && gamePhase === 'avstemning' && !hasVotedThisRound && (
          <div style={{marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '15px'}}>
            <h4>Stem på en mistenkt Forræder:</h4>
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {displayState.players
                .filter(p => p.isAlive && p.id !== currentPlayerId)
                .map(p => (
                  <li key={p.id} style={{marginBlock: '5px'}}>
                    <button
                      onClick={() => setSelectedVoteTarget(p.id)}
                      disabled={isLoading}
                      style={{backgroundColor: selectedVoteTarget === p.id ? 'lightblue' : undefined}}
                    >
                      Stem på {p.name}
                    </button>
                  </li>
              ))}
            </ul>
            {selectedVoteTarget && (
              <button onClick={handlePlayerVote} disabled={isLoading || hasVotedThisRound}>
                Bekreft stemme på {displayState.players.find(p=>p.id === selectedVoteTarget)?.name}
              </button>
            )}
            {error && <p style={{color: 'red'}}><small>Feil ved stemming: {error}</small></p>}
          </div>
        )}
        {amIAlive && gamePhase === 'avstemning' && hasVotedThisRound && (
            <p><i>Du har stemt i denne runden. Venter på resultater...</i></p>
        )}

        {amIAlive && myCurrentRole === 'Forræder' && gamePhase === 'natt' && !traitorActionMadeThisNight && (
          <div style={{marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '15px', backgroundColor: '#ffeeee'}}>
            <h4>Forræder Handling: Velg et offer</h4>
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {displayState.players
                .filter(p => p.isAlive && p.role !== 'Forræder' && p.id !== currentPlayerId)
                .map(p => (
                  <li key={p.id} style={{marginBlock: '5px'}}>
                    <button
                      onClick={() => setSelectedKillTarget(p.id)}
                      disabled={isLoading}
                      style={{backgroundColor: selectedKillTarget === p.id ? 'lightcoral' : undefined}}
                    >
                      Eliminer {p.name}
                    </button>
                  </li>
              ))}
            </ul>
            {selectedKillTarget && (
              <button onClick={handleTraitorAction} disabled={isLoading || traitorActionMadeThisNight}>
                Bekreft drap på {displayState.players.find(p=>p.id === selectedKillTarget)?.name}
              </button>
            )}
            {error && <p style={{color: 'red'}}><small>Feil ved forræderhandling: {error}</small></p>}
          </div>
        )}
        {amIAlive && myCurrentRole === 'Forræder' && gamePhase === 'natt' && traitorActionMadeThisNight && (
            <p><i>Du har valgt et offer for natten. Venter på morgengry...</i></p>
        )}

        {!amIAlive && <p style={{color: 'red', fontWeight:'bold', marginTop: '20px'}}>Du er ute av spillet.</p>}

      </div>
    </div>
  );
};

export default ForraederGame;
    }
  }, [socket, gameId, playerId]);

  const handleCreateGame = () => {
    if (socket && isHost) {
      // socket.emit('forraeder-create-game', { hostName: playerName });
      console.log('Host creating Forraeder game...');
    }
  };

  const handleStartGame = () => {
    if (socket && isHost && gameId) {
      // socket.emit('forraeder-start-game', { gameId });
      console.log('Host starting Forraeder game...');
    }
  };

  const handleSendAdminMessage = () => {
    if (socket && isHost && gameId && adminMessage.trim()) {
      // socket.emit('forraeder-send-admin-message', { gameId, message: adminMessage });
      console.log(`Admin sending message: ${adminMessage}`);
      setAdminMessage('');
    }
  };

  // Placeholder rendering
  if (!gameId || !playerId) {
    return <div>Laster Forræder-spill... (Mangler gameId eller playerId)</div>;
  }

  return (
    <div className="forraeder-game">
      <h1>Forræder på Hytta</h1>
      <p>Spill ID: {gameId}</p>
      <p>Spiller: {playerId}</p>

      {isHost && (
        <div className="admin-controls">
          <h2>Admin Panel</h2>
          {!gameState?.started && <button onClick={handleCreateGame} disabled={!!gameState?.id}>Opprett Spill (hvis ikke startet)</button>}
          {gameState?.id && !gameState?.started && <button onClick={handleStartGame}>Start Spill</button>}

          {gameState?.started && (
            <>
              <div>
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Skriv fellesmelding her..."
                />
                <button onClick={handleSendAdminMessage}>Send Melding</button>
              </div>
              {/* More admin controls for phases, votes etc. */}
            </>
          )}
        </div>
      )}

      <div className="player-view">
        <h2>Din Info</h2>
        {gameState ? (
          <>
            <p>Rolle: {gameState.role || 'Ikke tildelt'}</p>
            <p>Fase: {gameState.phase || 'Ukjent'}</p>
            <p>Poengpott: {gameState.points || 0}</p>
            <h3>Meldinger fra Admin:</h3>
            {/* <div className="messages">
              {(gameState.messages || []).map((msg, index) => (
                <p key={index}>{msg.text}</p>
              ))}
            </div> */}
          </>
        ) : (
          <p>Venter på spillstart...</p>
        )}
        {/* Player actions based on phase */}
      </div>
    </div>
  );
};

export default ForraederGame;
