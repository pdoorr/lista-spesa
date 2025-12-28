import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Check, Clock, History, Lightbulb, X, RefreshCw, Sparkles, Minus, Download, Upload, Percent, Database, GripVertical, Store } from 'lucide-react';
import { initializeDatabase, itemActions, historyActions, suggestionActions, exportActions, supermarketOrderActions, supermarketActions } from './db';
import './App.css';

function App() {
  const [items, setItems] = useState([]);
  const [completedItems, setCompletedItems] = useState([]);
  const [history, setHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [activeTab, setActiveTab] = useState('list');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [generatedList, setGeneratedList] = useState([]);
  const [newItem, setNewItem] = useState({ name: '', quantity: 1 });
  const [dbInitialized, setDbInitialized] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [groupSameDayItems, setGroupSameDayItems] = useState(true);
  const [selectedSupermarket, setSelectedSupermarket] = useState(null);
  const [showSupermarketModal, setShowSupermarketModal] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const fileInputRef = useRef(null);
  const itemListRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const [mouseY, setMouseY] = useState(0);

  const [supermarkets, setSupermarkets] = useState([]);
  const [showAddSupermarketModal, setShowAddSupermarketModal] = useState(false);
  const [newSupermarketName, setNewSupermarketName] = useState('');
  const [showClearHistoryModal, setShowClearHistoryModal] = useState(false);

  // Drag and drop state
  // Inizializza il database e carica i dati
  useEffect(() => {
    async function init() {
      await initializeDatabase();
      setDbInitialized(true);
      await loadSupermarkets();
      await loadData();
    }
    init();
  }, []);

  // Carica i dati dal database
  async function loadData(supermarketToUse = selectedSupermarket) {
    const [allItems, completed, hist, sugg] = await Promise.all([
      itemActions.getAll(),
      itemActions.getCompleted(),
      historyActions.getRecent(20),
      suggestionActions.getAll()
    ]);

    // Applica l'ordinamento del supermercato se specificato
    let finalItems = allItems;
    if (supermarketToUse && allItems.length > 0) {
      const order = await supermarketOrderActions.getBySupermarket(supermarketToUse);
      if (order.length > 0) {
        const orderedNames = order.map(o => o.itemName);
        const reorderedItems = orderedNames
          .map(name => allItems.find(item => item.name === name))
          .filter(Boolean);
        const remainingItems = allItems.filter(item =>
          !orderedNames.includes(item.name)
        );
        finalItems = [...reorderedItems, ...remainingItems];
      }
    }

    setItems(finalItems);
    setCompletedItems(completed);
    setHistory(hist);
    setSuggestions(sugg);
  }

  // Carica i supermercati dal database
  async function loadSupermarkets() {
    const savedSupermarkets = await supermarketActions.getAll();
    const supermarketNames = savedSupermarkets.map(s => s.name);
    setSupermarkets(supermarketNames);
  }

  // Aggiunge un nuovo item
  async function addItem(e) {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    await itemActions.add({
      name: newItem.name.trim(),
      quantity: newItem.quantity
    });

    setNewItem({ name: '', quantity: 1 });
    setShowAddForm(false);
    await loadData();
  }

  // Toggle completamento item
  async function toggleItem(id, completed) {
    if (completed) {
      // Se stiamo completando un articolo, prima aggiorniamo l'ordine
      // mettendo questo articolo in cima alla lista di quelli non completati
      const itemIndex = items.findIndex(item => item.id === id);
      if (itemIndex > 0 && selectedSupermarket) {
        // Rimuovi l'articolo dalla sua posizione
        const newItems = [...items];
        const [removedItem] = newItems.splice(itemIndex, 1);
        // Inseriscilo all'inizio della lista degli articoli non completati
        newItems.splice(0, 0, removedItem);
        // Salva il nuovo ordine
        await saveOrder(newItems);
      }
    }
    await itemActions.toggleComplete(id, completed);
    await loadData();
  }

  // Elimina item
  async function deleteItem(id) {
    await itemActions.delete(id);
    await loadData();
  }

  // Pulisci completati
  async function clearCompleted() {
    await itemActions.clearCompleted();
    await loadData();
  }

  // Genera lista dallo storico
  async function generateListFromHistory() {
    const list = await historyActions.generateShoppingList();
    setGeneratedList(list);
    setShowGenerateModal(true);
  }

  // Conferma generazione lista
  async function confirmGeneratedList() {
    if (generatedList.length === 0) return;
    
    await itemActions.addMultiple(generatedList);
    setShowGenerateModal(false);
    setGeneratedList([]);
    await loadData();
  }

  // Rimuovi articolo dalla lista generata
  function removeGeneratedItem(index) {
    const newList = generatedList.filter((_, i) => i !== index);
    setGeneratedList(newList);
  }

  // Aggiorna quantità nella lista generata
  function updateGeneratedQuantity(index, newQuantity) {
    if (newQuantity <= 0) return;
    const newList = [...generatedList];
    newList[index].quantity = newQuantity;
    setGeneratedList(newList);
  }

  // Converti quantità da intera a decimale e viceversa
  function toggleDecimalMode(quantity) {
    if (Number.isInteger(quantity)) {
      // Converti da intero a decimale (aggiunge 0.5 al valore intero)
      return quantity + 0.5;
    } else {
      // Converti da decimale a intero (usa solo la parte intera)
      return Math.floor(quantity);
    }
  }

  // Aggiorna quantità
  async function updateQuantity(id, newQuantity) {
    if (newQuantity <= 0) return;
    await itemActions.update(id, { quantity: newQuantity });
    await loadData();
  }

  // Funzioni per il drag and drop
  function handleDragStart(e, index) {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.innerHTML);

    // Aggiungi listener per il movimento del mouse
    document.addEventListener('mousemove', handleMouseMove);

    // Avvia l'auto-scroll
    startAutoScroll();
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  async function handleDrop(e, targetIndex) {
    e.preventDefault();
    if (draggedItem === null || draggedItem === targetIndex) return;

    const newItems = [...items];
    const [removed] = newItems.splice(draggedItem, 1);
    newItems.splice(targetIndex, 0, removed);

    // Salva il nuovo ordine
    await saveOrder(newItems);
    setItems(newItems);
    setDraggedItem(null);
  }

  function handleDragEnd() {
    setDraggedItem(null);
    stopAutoScroll();
    // Rimuovi il listener del mouse
    document.removeEventListener('mousemove', handleMouseMove);
  }

  function handleMouseMove(e) {
    setMouseY(e.clientY);
  }

  // Funzioni per l'auto-scroll durante il drag
  function startAutoScroll() {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    scrollIntervalRef.current = setInterval(() => {
      const scrollContainer = itemListRef.current;
      if (!scrollContainer) return;

      // Calcola la distanza dai bordi
      const viewportHeight = window.innerHeight;
      const currentMouseY = mouseY;

      // Margini di trigger per lo scroll (in pixel)
      const scrollMargin = 100;

      // Scroll in alto se siamo vicini al bordo superiore
      if (currentMouseY < scrollMargin && scrollContainer.scrollTop > 0) {
        scrollContainer.scrollTop -= 15;
      }

      // Scroll in basso se siamo vicini al bordo inferiore
      if (currentMouseY > viewportHeight - scrollMargin) {
        const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        if (scrollContainer.scrollTop < maxScroll) {
          scrollContainer.scrollTop += 15;
        }
      }
    }, 16); // Aggiorna ogni ~60fps
  }

  function stopAutoScroll() {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }

  // Pulisci l'intervallo e i listener quando il componente viene smontato
  useEffect(() => {
    return () => {
      stopAutoScroll();
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Salva l'ordine della lista per il supermercato selezionato
  async function saveOrder(itemsList) {
    // Salva l'ordine ottimale per questo supermercato
    // NOTA: Non modifichiamo gli articoli perché lo stesso articolo può essere comprato in più supermercati
    if (selectedSupermarket) {
      const itemNames = itemsList.map(item => item.name);
      await supermarketOrderActions.save(selectedSupermarket, itemNames);
    }
  }

  // Apri il modal dei supermercati
  function openSupermarketModal() {
    setShowSupermarketModal(true);
  }

  // Seleziona il supermercato
  async function selectSupermarket(supermarket) {
    setShowSupermarketModal(false);
    setSelectedSupermarket(supermarket);

    // Ricarica i dati con il nuovo ordinamento del supermercato specificato
    // Passiamo direttamente il parametro per evitare problemi di sincronizzazione dello stato
    await loadData(supermarket);
  }

  // Apri il modal per aggiungere un nuovo supermercato
  function openAddSupermarketModal() {
    setNewSupermarketName('');
    setShowAddSupermarketModal(true);
  }

  // Aggiunge un nuovo supermercato
  async function addNewSupermarket() {
    const name = newSupermarketName.trim();
    if (!name) return;
    if (supermarkets.includes(name)) {
      alert('Questo supermercato esiste già!');
      return;
    }

    // Salva nel database
    await supermarketActions.add(name);

    // Aggiorna lo stato locale
    const updated = [...supermarkets, name];
    setSupermarkets(updated);
    setShowAddSupermarketModal(false);
  }

  // Elimina un supermercato
  async function deleteSupermarket(supermarket) {
    // Elimina dal database
    await supermarketActions.deleteByName(supermarket);

    // Elimina anche l'ordine salvato per questo supermercato
    await supermarketOrderActions.deleteBySupermarket(supermarket);

    // Aggiorna lo stato locale
    const updated = supermarkets.filter(s => s !== supermarket);
    setSupermarkets(updated);

    // Deseleziona se era il supermercato selezionato
    if (selectedSupermarket === supermarket) {
      setSelectedSupermarket(null);
    }
  }

  // Esporta dati
  async function handleExport() {
    const jsonData = await exportActions.exportAll();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lista-spesa-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Importa dati
  async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const result = await exportActions.importAll(e.target.result);
      if (result.success) {
        setImportStatus({ type: 'success', message: 'Import completato con successo!' });
        await loadData();
        setTimeout(() => {
          setShowImportModal(false);
          setImportStatus(null);
        }, 2000);
      } else {
        setImportStatus({ type: 'error', message: `Errore: ${result.error}` });
      }
    };
    reader.readAsText(file);
  }

  // Usa suggerimento
  function useSuggestion(suggestion) {
    setNewItem({
      name: suggestion.name,
      quantity: 1
    });
    setShowAddForm(true);
    setShowSuggestions(false);
  }

  // Formatta data
  function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  // Genera dati di test
  async function handleGenerateTestData() {
    const count = await historyActions.generateTestData();
    await loadData();
    alert(`Generati ${count} articoli di test nello storico!`);
  }

  // Pulisci tutto lo storico
  async function handleClearHistory() {
    if (history.length === 0) return;
    setShowClearHistoryModal(true);
  }

  // Conferma eliminazione storico
  async function confirmClearHistory() {
    await historyActions.clear();
    await loadData();
    setShowClearHistoryModal(false);
  }

  // Formatta data solo (per header gruppo)
  function formatDateOnly(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    }).format(date);
  }

  // Raggruppa storico per giorno
  function groupHistoryByDay(historyItems) {
    const groups = {};
    historyItems.forEach(item => {
      const dateKey = new Date(item.purchasedAt).toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(item);
    });

    return Object.entries(groups)
      .map(([date, items]) => ({ date, items }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  // Raggruppa articoli con lo stesso nome nello stesso giorno
  function groupItemsByName(items) {
    if (!groupSameDayItems) return items;

    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.itemName]) {
        grouped[item.itemName] = {
          name: item.itemName,
          totalQuantity: 0,
          count: 0,
          times: []
        };
      }
      grouped[item.itemName].totalQuantity += item.quantity;
      grouped[item.itemName].count++;
      grouped[item.itemName].times.push(new Date(item.purchasedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    });

    return Object.values(grouped).sort((a, b) => b.count - a.count);
  }

  if (!dbInitialized) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>🛒 Lista Spesa</h1>
        <div className="header-actions">
          <button 
            className="btn-supermarket" 
            onClick={openSupermarketModal}
            title={selectedSupermarket || "Seleziona supermercato"}
          >
            <Store size={20} />
            <span>{selectedSupermarket || 'Supermercato'}</span>
          </button>
          <button
            className="btn-icon btn-add-supermarket"
            onClick={openAddSupermarketModal}
            title="Aggiungi supermercato"
          >
            <Plus size={20} />
          </button>
          <button 
            className="btn-icon" 
            onClick={generateListFromHistory}
            title="Genera dallo storico"
          >
            <Sparkles size={24} />
          </button>
          <button 
            className="btn-icon" 
            onClick={() => setShowSuggestions(true)}
            title="Suggerimenti"
          >
            <Lightbulb size={24} />
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          <Check size={18} />
          Lista
        </button>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          Storico
        </button>
      </nav>

      <main className="app-main">
        {activeTab === 'list' && (
          <>
            {/* Lista attiva */}
            <section className="section">
              <div className="section-header">
                <h2>Da comprare ({items.length})</h2>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">
                  <ShoppingCart size={48} />
                  <p>La lista è vuota</p>
                  <div className="empty-actions">
                    {history.length > 0 && (
                      <button className="btn btn-secondary" onClick={generateListFromHistory}>
                        <Sparkles size={18} />
                        Genera dallo storico
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <ul className="item-list" ref={itemListRef}>
                  {items.map((item, index) => (
                    <li 
                      key={item.id} 
                      className={`item-card ${draggedItem === index ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="item-info">
                        <div className="item-details">
                          <h3>{item.name}</h3>
                          <div className="quantity-controls">
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity - step) * 10) / 10;
                                updateQuantity(item.id, newValue > 0 ? newValue : 0.1);
                              }}
                              disabled={item.quantity <= 0.1}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="quantity-value">{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}</span>
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity + step) * 10) / 10;
                                updateQuantity(item.id, newValue);
                              }}
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              className="quantity-btn btn-toggle-decimal"
                              onClick={() => {
                                const newValue = toggleDecimalMode(item.quantity);
                                updateQuantity(item.id, newValue);
                              }}
                              title={Number.isInteger(item.quantity) ? "Passa a decimali" : "Passa a interi"}
                            >
                              <Percent size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="item-actions">
                        <GripVertical size={16} className="drag-handle" />
                        <button 
                          className="btn-icon btn-success"
                          onClick={() => toggleItem(item.id, true)}
                          title="Segna come comprato"
                        >
                          <Check size={20} />
                        </button>
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => deleteItem(item.id)}
                          title="Elimina"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Lista completata */}
            {completedItems.length > 0 && (
              <section className="section">
                <div className="section-header">
                  <h2>Comprati ({completedItems.length})</h2>
                  <button 
                    className="btn btn-danger"
                    onClick={clearCompleted}
                  >
                    Pulisci
                  </button>
                </div>
                <ul className="item-list completed">
                  {completedItems.map(item => (
                    <li key={item.id} className="item-card completed">
                      <div className="item-info">
                        <div className="item-details">
                          <h3>{item.name}</h3>
                          <div className="quantity-controls">
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity - step) * 10) / 10;
                                updateQuantity(item.id, newValue > 0 ? newValue : 0.1);
                              }}
                              disabled={item.quantity <= 0.1}
                            >
                              <Minus size={16} />
                            </button>
                            <span className="quantity-value">{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}</span>
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity + step) * 10) / 10;
                                updateQuantity(item.id, newValue);
                              }}
                            >
                              <Plus size={16} />
                            </button>
                            <button
                              className="quantity-btn btn-toggle-decimal"
                              onClick={() => {
                                const newValue = toggleDecimalMode(item.quantity);
                                updateQuantity(item.id, newValue);
                              }}
                              title={Number.isInteger(item.quantity) ? "Passa a decimali" : "Passa a interi"}
                            >
                              <Percent size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="item-actions">
                        <button 
                          className="btn-icon"
                          onClick={() => toggleItem(item.id, false)}
                          title="Riporta in lista"
                        >
                          <Clock size={18} />
                        </button>
                        <button 
                          className="btn-icon btn-danger"
                          onClick={() => deleteItem(item.id)}
                          title="Elimina"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <section className="section">
            <div className="section-header">
              <h2>Storico Acquisti</h2>
              <div className="header-buttons">
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateTestData}
                  title="Genera dati di test"
                >
                  <Database size={18} />
                  Test
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={generateListFromHistory}
                >
                  <Sparkles size={18} />
                  Genera
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowImportModal(true)}
                >
                  <Upload size={18} />
                  Importa
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleExport}
                >
                  <Download size={18} />
                  Esporta
                </button>
                {history.length > 0 && (
                  <button
                    className="btn btn-danger"
                    onClick={handleClearHistory}
                    title="Elimina tutto lo storico"
                  >
                    <Trash2 size={18} />
                    Pulisci
                  </button>
                )}
              </div>
            </div>
            {history.length === 0 ? (
              <div className="empty-state">
                <History size={48} />
                <p>Nessun acquisto registrato</p>
              </div>
            ) : (
              <>
                <div className="history-toggle-container">
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={groupSameDayItems}
                      onChange={(e) => setGroupSameDayItems(e.target.checked)}
                      className="toggle-checkbox"
                    />
                    <span className="toggle-slider"></span>
                    <span>Raggruppa articoli nello stesso giorno</span>
                  </label>
                </div>
                <div className="history-container">
                  {groupHistoryByDay(history).map((group, groupIndex) => (
                    <div key={group.date} className={`history-day-group day-color-${groupIndex % 6}`}>
                      <div className="history-day-header">
                        <span className="history-day-title">{formatDateOnly(group.date)}</span>
                        <span className="history-day-count">{group.items.length} {group.items.length === 1 ? 'acquisto' : 'acquisti'}</span>
                      </div>
                      {groupSameDayItems ? (
                        <ul className="history-list">
                          {groupItemsByName(group.items).map((item, index) => (
                            <li key={`${group.date}-${item.name}`} className="history-item grouped">
                              <div className="history-details">
                                <h3>{item.name}</h3>
                                <div className="history-times">
                                  {item.times.map((time, i) => (
                                    <span key={i} className="history-time">{time}</span>
                                  ))}
                                </div>
                              </div>
                              <div className="history-quantity">
                                <span>{Number.isInteger(item.totalQuantity) ? item.totalQuantity : item.totalQuantity.toFixed(1)}</span>
                                <span className="history-count-badge">{item.count} {item.count === 1 ? 'v' : 'v'}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <ul className="history-list">
                          {group.items.map(item => (
                            <li key={item.id} className="history-item">
                              <div className="history-details">
                                <h3>{item.itemName}</h3>
                                <p className="history-meta">
                                  {new Date(item.purchasedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <div className="history-quantity">
                                <span>{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* Floating Add Button */}
      <button
        className="floating-add-btn"
        onClick={() => setShowAddForm(true)}
        title="Aggiungi prodotto"
      >
        <Plus size={28} />
      </button>

      {/* Form aggiungi item */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Aggiungi Prodotto</h3>
              <button className="btn-icon" onClick={() => setShowAddForm(false)}>
                <X size={24} />
              </button>
            </div>
            <form onSubmit={addItem} className="add-form">
              <div className="form-group">
                <label>Nome prodotto</label>
                <input
                  type="text"
                  className="input"
                  value={newItem.name}
                  onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Es: Latte"
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label>Quantità</label>
                <input
                  type="number"
                  className="input"
                  value={newItem.quantity}
                  onChange={e => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 1 })}
                  onFocus={e => e.target.select()}
                  min="0.1"
                  step="0.1"
                  required
                />
              </div>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setShowAddForm(false)}>
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Aggiungi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suggerimenti */}
      {showSuggestions && (
        <div className="modal-overlay" onClick={() => setShowSuggestions(false)}>
          <div className="modal suggestions-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Suggerimenti</h3>
              <button className="btn-icon" onClick={() => setShowSuggestions(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="suggestions-list">
              {suggestions.length === 0 ? (
                <div className="empty-state">
                  <Lightbulb size={48} />
                  <p>Nessun suggerimento</p>
                  <p className="text-sm">I prodotti che compri più spesso appariranno qui</p>
                </div>
              ) : (
                suggestions.map(suggestion => (
                  <button
                    key={suggestion.id}
                    className="suggestion-item"
                    onClick={() => useSuggestion(suggestion)}
                  >
                    <div className="suggestion-details">
                      <h4>{suggestion.name}</h4>
                      <p>{suggestion.frequency} acquisti</p>
                    </div>
                    <Plus size={18} />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal generazione lista */}
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Genera Lista dallo Storico</h3>
              <button className="btn-icon" onClick={() => setShowGenerateModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="generate-modal-content">
              {generatedList.length === 0 ? (
                <div className="empty-state">
                  <History size={48} />
                  <p>Nessun dato nello storico</p>
                  <p className="text-sm">Inizia ad acquistare prodotti per generare suggerimenti</p>
                </div>
              ) : (
                <>
                  <p className="generate-info">
                    {generatedList.length} prodotti generati basati sulla frequenza di acquisto
                  </p>
                  <ul className="generated-list">
                    {generatedList.map((item, index) => (
                      <li key={index} className="generated-item">
                        <div className="generated-item-info">
                          <span className="generated-name">{item.name}</span>
                          <span className="generated-meta">
                            {item.frequency} acquisti
                          </span>
                        </div>
                        <div className="generated-item-controls">
                          <div className="quantity-controls">
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity - step) * 10) / 10;
                                updateGeneratedQuantity(index, newValue > 0 ? newValue : 0.1);
                              }}
                              disabled={item.quantity <= 0.1}
                            >
                              <Minus size={14} />
                            </button>
                            <span className="quantity-value">{Number.isInteger(item.quantity) ? item.quantity : item.quantity.toFixed(1)}</span>
                            <button
                              className="quantity-btn"
                              onClick={() => {
                                const isDecimal = !Number.isInteger(item.quantity);
                                const step = isDecimal ? 0.1 : 1;
                                const newValue = Math.round((item.quantity + step) * 10) / 10;
                                updateGeneratedQuantity(index, newValue);
                              }}
                            >
                              <Plus size={14} />
                            </button>
                            <button
                              className="quantity-btn btn-toggle-decimal"
                              onClick={() => {
                                const newValue = toggleDecimalMode(item.quantity);
                                updateGeneratedQuantity(index, newValue);
                              }}
                              title={Number.isInteger(item.quantity) ? "Passa a decimali" : "Passa a interi"}
                            >
                              <Percent size={12} />
                            </button>
                          </div>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => removeGeneratedItem(index)}
                            title="Rimuovi dalla lista"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="form-actions">
                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => setShowGenerateModal(false)}
                    >
                      Annulla
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={confirmGeneratedList}
                    >
                      <RefreshCw size={18} />
                      Crea Lista
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

        {/* Modal Import */}
        {showImportModal && (
          <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Importa Dati</h3>
                <button className="btn-icon" onClick={() => setShowImportModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="import-modal-content">
                <p className="import-info">
                  Seleziona un file di backup JSON per importare i tuoi dati.
                  Questo sostituirà tutti i dati attuali.
                </p>
                {importStatus && (
                  <div className={`import-status ${importStatus.type}`}>
                    {importStatus.message}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="file-input"
                />
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setShowImportModal(false);
                      setImportStatus(null);
                    }}
                  >
                    Chiudi
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => fileInputRef.current.click()}
                  >
                    <Upload size={18} />
                    Seleziona File
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Supermercati */}
        {showSupermarketModal && (
          <div className="modal-overlay" onClick={() => setShowSupermarketModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Seleziona Supermercato</h3>
                <button className="btn-icon" onClick={() => setShowSupermarketModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="supermarket-grid">
                {supermarkets.map(supermarket => (
                  <button
                    key={supermarket}
                    className={`supermarket-card ${selectedSupermarket === supermarket ? 'active' : ''}`}
                    onClick={() => selectSupermarket(supermarket)}
                  >
                    <Store size={32} />
                    <span>{supermarket}</span>
                    <button
                      className="supermarket-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSupermarket(supermarket);
                      }}
                      title="Elimina supermercato"
                    >
                      <Trash2 size={16} />
                    </button>
                  </button>
                ))}
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowSupermarketModal(false)}
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openAddSupermarketModal}
                >
                  <Plus size={18} />
                  Aggiungi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Aggiungi Supermercato */}
        {showAddSupermarketModal && (
          <div className="modal-overlay" onClick={() => setShowAddSupermarketModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Aggiungi Nuovo Supermercato</h3>
                <button className="btn-icon" onClick={() => setShowAddSupermarketModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="form-group">
                <label>Nome Supermercato:</label>
                <input
                  type="text"
                  value={newSupermarketName}
                  onChange={(e) => setNewSupermarketName(e.target.value)}
                  placeholder="Inserisci il nome del supermercato..."
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addNewSupermarket();
                    }
                  }}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAddSupermarketModal(false)}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={addNewSupermarket}
                >
                  <Check size={18} />
                  Salva
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Conferma Eliminazione Storico */}
        {showClearHistoryModal && (
          <div className="modal-overlay" onClick={() => setShowClearHistoryModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>⚠️ Conferma Eliminazione</h3>
                <button className="btn-icon" onClick={() => setShowClearHistoryModal(false)}>
                  <X size={24} />
                </button>
              </div>
              <div className="confirm-modal-content">
                <div className="confirm-warning">
                  <Trash2 size={48} className="warning-icon" />
                  <p>Sei sicuro di voler eliminare tutto lo storico degli acquisti?</p>
                  <p className="confirm-details">
                    Verranno eliminati <strong>{history.length} record</strong>.
                  </p>
                  <p className="confirm-alert">
                    ⚠️ Questa azione è irreversibile!
                  </p>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setShowClearHistoryModal(false)}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={confirmClearHistory}
                  >
                    <Trash2 size={18} />
                    Elimina Tutto
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// Icona carrello per empty state
function ShoppingCart({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1"></circle>
      <circle cx="20" cy="21" r="1"></circle>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
    </svg>
  );
}

export default App;
