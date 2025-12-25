import { useState } from 'react';
import { Header } from './Header';
import { DocumentCreator } from './DocumentCreator';
import { DocumentWorkspace } from './DocumentWorkspace';
import '../styles/DocumentApp.css';

export function DocumentApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'workspace'>('create');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreated = () => {
    setRefreshKey(Date.now());
    setActiveTab('workspace');
  };

  return (
    <div className="vault-layout">
      <Header />
      <main className="content-shell">
        <div className="tab-row">
          <button
            className={`tab-chip ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Create document
          </button>
          <button
            className={`tab-chip ${activeTab === 'workspace' ? 'active' : ''}`}
            onClick={() => setActiveTab('workspace')}
          >
            Manage & decrypt
          </button>
        </div>

        {activeTab === 'create' ? (
          <DocumentCreator onCreated={handleCreated} />
        ) : (
          <DocumentWorkspace refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
