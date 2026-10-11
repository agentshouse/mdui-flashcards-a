import {DataProvider} from "./context/DataContext.tsx";
import {HashRouter, Route, Routes, useLocation} from "react-router";
import {DashboardPage} from "./components/DashboardPage.tsx";
import {CreateDeckPage} from "./components/CreateDeckPage.tsx";
import {ViewDeckPage} from "./components/ViewDeckPage.tsx";
import {ReviewPage} from "./components/ReviewPage.tsx";
import Home from "./components/Home.tsx";
import Layout from "./components/Layout.tsx";


function App() {

    return (
        <DataProvider>
            <HashRouter>
                <PageRoutes/>
            </HashRouter>
        </DataProvider>
    )
}

export default App

function PageRoutes() {const location = useLocation();
    if (location.pathname === "/" || location.pathname === "/home") return <Home/>;
    const active = location.pathname.split("/")[1] === "decks" ? location.pathname.split("/")[2] : location.pathname === "/create-deck" ? "create" : "dashboard";
    return (
                <Layout active={active}>
                <Routes key={location.pathname}>
                    <Route path="/" element={<Home />}/>
                    <Route path="/home" element={<Home />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/create-deck" element={<CreateDeckPage/>}/>
                    <Route path="/decks/:deckId" element={<ViewDeckPage/>}/>
                    <Route path="/decks/:deckId/study" element={<ReviewPage studyMode={true}/>}/>
                    <Route path="/decks/:deckId/review" element={<ReviewPage studyMode={false}/>}/>
                </Routes>
                </Layout>
);}
