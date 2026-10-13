import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Landing } from "./components/pages/Landing";
import { CreateGame } from "./components/pages/CreateGame";
import { DraftCreate } from "./components/pages/DraftCreate";
import { DraftLobby } from "./components/pages/DraftLobby";
import { GameView } from "./components/pages/GameView";
import { ReplayList } from "./components/pages/ReplayList";
import { ReplayViewer } from "./components/pages/ReplayViewer";
import { BugReports } from "./components/pages/BugReports";
import "./theme.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/create" element={<CreateGame />} />
        <Route path="/draft/create" element={<DraftCreate />} />
        <Route path="/draft/:draftId" element={<DraftLobby />} />
        <Route path="/game/:gameId" element={<GameView />} />
        <Route path="/replays" element={<ReplayList />} />
        <Route path="/replay/:gameId" element={<ReplayViewer />} />
        {/* Public share link: same viewer, pre-baked data, no admin token. */}
        <Route path="/shared/:token" element={<ReplayViewer />} />
        <Route path="/reports" element={<BugReports />} />
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
