import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import GrammarList from "./pages/GrammarList";
import GrammarLessonPage from "./pages/GrammarLesson";
import VocabList from "./pages/VocabList";
import VocabDeckPage from "./pages/VocabDeck";
import StoriesList from "./pages/StoriesList";
import StoryPage from "./pages/Story";
import QuizList from "./pages/QuizList";
import QuizPage from "./pages/Quiz";
import Pronunciation from "./pages/Pronunciation";
import Listening from "./pages/Listening";
import Reinforcement from "./pages/Reinforcement";
import KnowledgeTestPage from "./pages/KnowledgeTest";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/grammar" element={<GrammarList />} />
        <Route path="/grammar/:id" element={<GrammarLessonPage />} />
        <Route path="/vocab" element={<VocabList />} />
        <Route path="/vocab/:id" element={<VocabDeckPage />} />
        <Route path="/stories" element={<StoriesList />} />
        <Route path="/stories/:id" element={<StoryPage />} />
        <Route path="/quizzes" element={<QuizList />} />
        <Route path="/quizzes/:id" element={<QuizPage />} />
        <Route path="/pronunciation" element={<Pronunciation />} />
        <Route path="/listening" element={<Listening />} />
        <Route path="/reinforcement" element={<Reinforcement />} />
        <Route path="/knowledge/:type/:id" element={<KnowledgeTestPage />} />
      </Routes>
    </Layout>
  );
}
