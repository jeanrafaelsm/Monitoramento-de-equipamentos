// Variáveis globais
let map;
let equipmentData = [];
let equipmentModelData = [];
let equipmentStateData = [];
let equipmentStateHistoryData = [];
let equipmentPositionHistoryData = [];
let markers = {};

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async function() {
    // Carrega todos os dados
    await loadAllData();
    
    // Inicializa o mapa
    initMap();
    
    // Plota os equipamentos no mapa
    plotEquipmentOnMap();
    
    // Preenche os filtros
    populateFilters();
    
    // Configura eventos dos filtros
    setupFilterEvents();
});

// Carrega todos os dados JSON
async function loadAllData() {
    try {
        const responses = await Promise.all([
            fetch('data/equipment.json').then(r => r.json()),
            fetch('data/equipmentModel.json').then(r => r.json()),
            fetch('data/equipmentState.json').then(r => r.json()),
            fetch('data/equipmentStateHistory.json').then(r => r.json()),
            fetch('data/equipmentPositionHistory.json').then(r => r.json())
        ]);
        
        equipmentData = responses[0];
        equipmentModelData = responses[1];
        equipmentStateData = responses[2];
        equipmentStateHistoryData = responses[3];
        equipmentPositionHistoryData = responses[4];
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Erro ao carregar dados. Verifique o console para mais detalhes.');
    }
}

// Inicializa o mapa com Leaflet
function initMap() {
    // Coordenadas aproximadas do Brasil como padrão
    map = L.map('map').setView([-14.2350, -51.9253], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
}

// Plota os equipamentos no mapa
function plotEquipmentOnMap() {
    // Limpa marcadores existentes
    Object.values(markers).forEach(marker => map.removeLayer(marker));
    markers = {};
    
    equipmentData.forEach(equipment => {
        // Encontra a posição mais recente do equipamento
        const positionHistory = equipmentPositionHistoryData.find(
            eph => eph.equipmentId === equipment.id
        );
        
        if (!positionHistory || positionHistory.positions.length === 0) return;
        
        const latestPosition = positionHistory.positions.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        });
        
        // Encontra o estado mais recente
        const stateHistory = equipmentStateHistoryData.find(
            esh => esh.equipmentId === equipment.id
        );
        
        let latestState = null;
        if (stateHistory && stateHistory.states.length > 0) {
            latestState = stateHistory.states.reduce((latest, current) => {
                return new Date(current.date) > new Date(latest.date) ? current : latest;
            });
        }
        
        // Cria o marcador
        const marker = L.marker([latestPosition.lat, latestPosition.lon], {
            icon: createCustomIcon(equipment, latestState)
        }).addTo(map);
        
        // Configura o popup
        const popupContent = createPopupContent(equipment, latestState);
        marker.bindPopup(popupContent);
        
        // Adiciona evento de clique para mostrar detalhes
        marker.on('click', function() {
            showEquipmentDetails(equipment.id);
        });
        
        // Armazena o marcador para referência futura
        markers[equipment.id] = marker;
    });
}

// Cria ícone personalizado para o marcador
function createCustomIcon(equipment, latestState) {
    const state = latestState ? 
        equipmentStateData.find(s => s.id === latestState.equipmentStateId) : 
        null;
    
    const color = state ? state.color : '#999';
    
    return L.divIcon({
        className: 'equipment-marker',
        html: `<div style="background-color: ${color}; width: 30px; height: 30px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  ${equipment.name.substring(0, 3)}
               </div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// Cria conteúdo do popup
function createPopupContent(equipment, latestState) {
    const model = equipmentModelData.find(m => m.id === equipment.equipmentModelId);
    const state = latestState ? 
        equipmentStateData.find(s => s.id === latestState.equipmentStateId) : 
        { name: 'Desconhecido', color: '#999' };
    
    return `
        <div>
            <h5>${equipment.name}</h5>
            <p><strong>Modelo:</strong> ${model ? model.name : 'Desconhecido'}</p>
            <p><strong>Estado:</strong> 
                <span class="state-badge" style="background-color: ${state.color}">
                    ${state.name}
                </span>
            </p>
            <p><small>Clique para ver detalhes</small></p>
        </div>
    `;
}

// Mostra detalhes do equipamento no painel lateral
function showEquipmentDetails(equipmentId) {
    const equipment = equipmentData.find(e => e.id === equipmentId);
    if (!equipment) return;
    
    const model = equipmentModelData.find(m => m.id === equipment.equipmentModelId);
    const stateHistory = equipmentStateHistoryData.find(esh => esh.equipmentId === equipmentId);
    const positionHistory = equipmentPositionHistoryData.find(eph => eph.equipmentId === equipmentId);
    
    // Calcula produtividade (extra)
    const productivity = calculateProductivity(stateHistory);
    
    // Preenche informações básicas
    document.getElementById('equipmentInfo').innerHTML = `
        <div class="card">
            <div class="card-body">
                <h5 class="card-title">${equipment.name}</h5>
                <p class="card-text"><strong>Modelo:</strong> ${model ? model.name : 'Desconhecido'}</p>
                <p class="card-text"><strong>Produtividade:</strong> ${productivity.toFixed(2)}%</p>
            </div>
        </div>
    `;
    
    // Mostra o gráfico de histórico de estados
    renderStateHistoryChart(equipmentId);
    
    // Mostra o painel de detalhes
    document.getElementById('equipmentDetails').classList.remove('d-none');
}

// Calcula produtividade (extra)
function calculateProductivity(stateHistory) {
    if (!stateHistory || stateHistory.states.length === 0) return 0;
    
    // Ordena estados por data
    const sortedStates = [...stateHistory.states].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Encontra o primeiro e último registro
    const firstDate = new Date(sortedStates[0].date);
    const lastDate = new Date(sortedStates[sortedStates.length - 1].date);
    
    // Calcula total de horas no período
    const totalHours = (lastDate - firstDate) / (1000 * 60 * 60);
    if (totalHours <= 0) return 0;
    
    // Calcula horas operando
    let operatingHours = 0;
    const operatingStateId = equipmentStateData.find(s => s.name === 'Operando')?.id;
    
    for (let i = 0; i < sortedStates.length - 1; i++) {
        const current = sortedStates[i];
        const next = sortedStates[i + 1];
        
        const currentDate = new Date(current.date);
        const nextDate = new Date(next.date);
        const durationHours = (nextDate - currentDate) / (1000 * 60 * 60);
        
        if (current.equipmentStateId === operatingStateId) {
            operatingHours += durationHours;
        }
    }
    
    // Calcula produtividade
    return (operatingHours / totalHours) * 100;
}

// Renderiza gráfico de histórico de estados
function renderStateHistoryChart(equipmentId) {
    const stateHistory = equipmentStateHistoryData.find(esh => esh.equipmentId === equipmentId);
    if (!stateHistory || stateHistory.states.length === 0) {
        document.getElementById('stateHistoryChart').innerHTML = '<p>Nenhum histórico de estados disponível.</p>';
        return;
    }
    
    // Ordena estados por data
    const sortedStates = [...stateHistory.states].sort((a, b) => 
        new Date(a.date) - new Date(b.date)
    );
    
    // Prepara dados para o gráfico
    const labels = sortedStates.map(state => 
        new Date(state.date).toLocaleDateString('pt-BR') + ' ' + 
        new Date(state.date).toLocaleTimeString('pt-BR')
    );
    
    const backgroundColors = sortedStates.map(state => {
        const stateInfo = equipmentStateData.find(s => s.id === state.equipmentStateId);
        return stateInfo ? stateInfo.color : '#999';
    });
    
    const ctx = document.createElement('canvas');
    document.getElementById('stateHistoryChart').innerHTML = '';
    document.getElementById('stateHistoryChart').appendChild(ctx);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Estado do Equipamento',
                data: new Array(sortedStates.length).fill(1), // Todos com valor 1 para altura uniforme
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    display: false
                },
                x: {
                    ticks: {
                        autoSkip: true,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const stateId = sortedStates[context.dataIndex].equipmentStateId;
                            const state = equipmentStateData.find(s => s.id === stateId);
                            return state ? state.name : 'Desconhecido';
                        }
                    }
                }
            }
        }
    });
}

// Preenche os filtros
function populateFilters() {
    const equipmentFilter = document.getElementById('equipmentFilter');
    const stateFilter = document.getElementById('stateFilter');
    const modelFilter = document.getElementById('modelFilter');
    
    // Equipamentos
    equipmentData.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment.id;
        option.textContent = equipment.name;
        equipmentFilter.appendChild(option);
    });
    
    // Estados
    equipmentStateData.forEach(state => {
        const option = document.createElement('option');
        option.value = state.id;
        option.textContent = state.name;
        stateFilter.appendChild(option);
    });
    
    // Modelos
    equipmentModelData.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelFilter.appendChild(option);
    });
}

// Configura eventos dos filtros
function setupFilterEvents() {
    document.getElementById('equipmentFilter').addEventListener('change', applyFilters);
    document.getElementById('stateFilter').addEventListener('change', applyFilters);
    document.getElementById('modelFilter').addEventListener('change', applyFilters);
    
}

// Aplica os filtros selecionados
function applyFilters() {
    const equipmentFilter = document.getElementById('equipmentFilter').value;
    const stateFilter = document.getElementById('stateFilter').value;
    const modelFilter = document.getElementById('modelFilter').value;
    
    equipmentData.forEach(equipment => {
        const marker = markers[equipment.id];
        if (!marker) return;
        
        // Verifica filtro de modelo
        const modelMatch = modelFilter === 'all' || equipment.equipmentModelId === modelFilter;
        
        // Verifica filtro de equipamento
        const equipmentMatch = equipmentFilter === 'all' || equipment.id === equipmentFilter;
        
        // Verifica filtro de estado
        let stateMatch = true;
        if (stateFilter !== 'all') {
            const stateHistory = equipmentStateHistoryData.find(esh => esh.equipmentId === equipment.id);
            if (stateHistory && stateHistory.states.length > 0) {
                const latestState = stateHistory.states.reduce((latest, current) => {
                    return new Date(current.date) > new Date(latest.date) ? current : latest;
                });
                stateMatch = latestState.equipmentStateId === stateFilter;
            } else {
                stateMatch = false;
            }
        }
        
        // Mostra ou esconde o marcador com base nos filtros
        if (modelMatch && equipmentMatch && stateMatch) {
            map.addLayer(marker);
        } else {
            map.removeLayer(marker);
        }
    });
}

// Função para enquadrar os marcadores visíveis no mapa
function fitMapToVisibleMarkers() {
    const visibleMarkers = Object.values(markers).filter(marker => map.hasLayer(marker));
    
    if (visibleMarkers.length === 0) {
        alert('Nenhum equipamento visível para enquadrar!');
        return;
    }

    // Cria um grupo de marcadores para calcular os bounds
    const group = new L.featureGroup(visibleMarkers);
    map.fitBounds(group.getBounds(), {
        padding: [50, 50], // Espaçamento extra em pixels
        maxZoom: 15 // Zoom máximo permitido
    });
}