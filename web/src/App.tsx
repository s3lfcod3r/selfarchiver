import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.js';
import { Spinner } from './components/ui.js';
import { api } from './lib/api.js';
import Archive from './pages/Archive.js';
import Dashboard from './pages/Dashboard.js';
import Login from './pages/Login.js';
import Rules from './pages/Rules.js';
import Runs from './pages/Runs.js';
import Sources from './pages/Sources.js';

export default function App() {
    const [state, setState] = useState<{ loading: boolean; authRequired: boolean; authenticated: boolean }>({
        loading: true,
        authRequired: false,
        authenticated: true,
    });

    useEffect(() => {
        api.session()
            .then((s) => setState({ loading: false, authRequired: s.authRequired, authenticated: s.authenticated }))
            .catch(() => setState({ loading: false, authRequired: true, authenticated: false }));
    }, []);

    if (state.loading) {
        return (
            <div className="flex h-full items-center justify-center text-muted">
                <Spinner />
            </div>
        );
    }

    if (state.authRequired && !state.authenticated) {
        return <Login onSuccess={() => setState((s) => ({ ...s, authenticated: true }))} />;
    }

    return (
        <Routes>
            <Route element={<Layout authRequired={state.authRequired} />}>
                <Route index element={<Dashboard />} />
                <Route path="/sources" element={<Sources />} />
                <Route path="/rules" element={<Rules />} />
                <Route path="/archive" element={<Archive />} />
                <Route path="/runs" element={<Runs />} />
            </Route>
        </Routes>
    );
}
