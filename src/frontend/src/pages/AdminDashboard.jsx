import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  const [abaAtiva, setAbaAtiva] = useState('empresas');

  // ================= ESTADOS DE EMPRESAS =================
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [emailEmpresa, setEmailEmpresa] = useState('');
  const [cnpjEmpresa, setCnpjEmpresa] = useState('');
  const [urlBookingEmpresa, setUrlBookingEmpresa] = useState(''); // NOVO: Para cadastro
  
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [emailCadastrado, setEmailCadastrado] = useState('');
  const [mensagemEmpresa, setMensagemEmpresa] = useState('');
  const [erroEmpresa, setErroEmpresa] = useState('');
  const [listaEmpresas, setListaEmpresas] = useState([]);
  const [senhaResetada, setSenhaResetada] = useState(null);
  const [empresaResetada, setEmpresaResetada] = useState('');

  const [modalEdicaoEmpresaAberto, setModalEdicaoEmpresaAberto] = useState(false);
  const [empresaSendoEditada, setEmpresaSendoEditada] = useState(null);
  const [editNome, setEditNome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCnpj, setEditCnpj] = useState('');
  const [editUrlBooking, setEditUrlBooking] = useState('');

  // ================= ESTADOS DE FORMULÁRIOS =================
  const [tituloForm, setTituloForm] = useState('');
  const [descricaoForm, setDescricaoForm] = useState('');
  const [urlForm, setUrlForm] = useState('');
  const [listaFormularios, setListaFormularios] = useState([]);
  const [mensagemForm, setMensagemForm] = useState('');
  const [erroForm, setErroForm] = useState('');
  const [empresasSelecionadas, setEmpresasSelecionadas] = useState([]);

  // ================= ESTADOS DO MODAL DE EDIÇÃO =================
  const [modalAberto, setModalAberto] = useState(false);
  const [formSendoEditado, setFormSendoEditado] = useState(null);
  const [empresasEdicao, setEmpresasEdicao] = useState([]);
  const [mensagemEdicao, setMensagemEdicao] = useState('');

  // ================= ESTADOS DE SCRAPING =================
  const [empresasScraping, setEmpresasScraping] = useState([]); 
  const [repetirACada, setRepetirACada] = useState(1);
  const [unidadeTempo, setUnidadeTempo] = useState('semana');
  const [diasSelecionados, setDiasSelecionados] = useState([]);
  const [diaDoMes, setDiaDoMes] = useState(1);
  const [mensagemScraping, setMensagemScraping] = useState('');
  
  // Lista temporária de logs para vermos a tela funcionando
  const [logsScraping, setLogsScraping] = useState([
    { id: 1, data: '2026-06-01 03:00', status: 'Sucesso', detalhes: '15 avaliações extraídas.' },
    { id: 2, data: '2026-05-31 03:00', status: 'Falha', detalhes: 'Timeout ao conectar no Booking.' }
  ]);

  const diasSemana = [
    { id: 'dom', label: 'D' }, { id: 'seg', label: 'S' }, { id: 'ter', label: 'T' },
    { id: 'qua', label: 'Q' }, { id: 'qui', label: 'Q' }, { id: 'sex', label: 'S' }, { id: 'sab', label: 'S' }
  ];

  const sair = () => {
    localStorage.removeItem('usuario');
    navigate('/');
  };

  useEffect(() => {
    carregarEmpresas();
    carregarFormularios();
  }, []);

  const carregarEmpresas = async () => {
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/empresas');
      if (resposta.ok) {
        const dados = await resposta.json();
        setListaEmpresas(dados);
      }
    } catch (error) {
      console.error("Erro ao carregar empresas");
    }
  };

  const carregarFormularios = async () => {
    try {
      const resposta = await fetch('http://localhost:8000/api/formularios');
      if (resposta.ok) {
        const dados = await resposta.json();
        setListaFormularios(dados);
      }
    } catch (error) {
      console.error("Erro ao carregar formulários");
    }
  };

  // Funções de Cadastro (Empresas e Formulários)
  const handleCadastrarEmpresa = async (e) => {
    e.preventDefault();
    setErroEmpresa(''); setMensagemEmpresa(''); setSenhaGerada(null); setSenhaResetada(null);
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/cadastrar-empresa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          nome: nomeEmpresa, 
          email: emailEmpresa, 
          cnpj: cnpjEmpresa,
          url_booking: urlBookingEmpresa // <--- Enviando para o Python
        }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        setMensagemEmpresa(dados.mensagem);
        setSenhaGerada(dados.senha_gerada); setEmailCadastrado(emailEmpresa);
        setNomeEmpresa(''); setEmailEmpresa(''); setCnpjEmpresa(''); setUrlBookingEmpresa('');
        carregarEmpresas();
      } else {
        setErroEmpresa(dados.detail || 'Erro ao cadastrar.');
      }
    } catch (error) {
      setErroEmpresa('Erro de conexão.');
    }
  };

  // --- NOVAS FUNÇÕES DE EDIÇÃO DE EMPRESA ---
  const abrirModalEdicaoEmpresa = (empresa) => {
    setEmpresaSendoEditada(empresa);
    setEditNome(empresa.nome);
    setEditEmail(empresa.email);
    setEditCnpj(empresa.cnpj || '');
    setEditUrlBooking(empresa.url_booking || '');
    setModalEdicaoEmpresaAberto(true);
  };

  const handleSalvarEdicaoEmpresa = async (e) => {
    e.preventDefault();
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/empresas/${empresaSendoEditada.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editNome,
          email: editEmail,
          cnpj: editCnpj,
          url_booking: editUrlBooking
        }),
      });
      
      if (resposta.ok) {
        setModalEdicaoEmpresaAberto(false);
        carregarEmpresas(); // Recarrega a tabela para mostrar os novos dados
      } else {
        alert("Erro ao atualizar os dados da empresa.");
      }
    } catch (error) {
      alert("Erro de conexão com o servidor.");
    }
  };
  const handleCadastrarFormulario = async (e) => {
    e.preventDefault();
    setErroForm(''); setMensagemForm('');
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/formularios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: tituloForm, descricao: descricaoForm, url_google_forms: urlForm, empresas_ids: empresasSelecionadas }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        setMensagemForm('Formulário vinculado com sucesso!');
        setTituloForm(''); setDescricaoForm(''); setUrlForm(''); setEmpresasSelecionadas([]);
        carregarFormularios();
      } else {
        setErroForm(dados.detail || 'Erro ao cadastrar.');
      }
    } catch (error) {
      setErroForm('Erro de conexão.');
    }
  };

  // Funções Extras (Reset Senha e Modais)
  const handleResetarSenha = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja resetar a senha de ${nome}?`)) return;
    setSenhaGerada(null); setSenhaResetada(null);
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/resetar-senha', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: id }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        setSenhaResetada(dados.nova_senha_gerada); setEmpresaResetada(nome);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        alert(dados.detail || "Erro ao resetar");
      }
    } catch (error) {
      alert("Erro de conexão");
    }
  };

  const abrirModalEdicao = async (form) => {
    setFormSendoEditado(form); setMensagemEdicao(''); setModalAberto(true);
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/formularios/${form.id}/empresas`);
      if (resposta.ok) {
        const idsMarcados = await resposta.json();
        setEmpresasEdicao(idsMarcados);
      }
    } catch (error) {
      console.error("Erro ao buscar destinatários");
    }
  };

  const salvarEdicaoDestinatarios = async () => {
    setMensagemEdicao('Salvando...');
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/formularios/${formSendoEditado.id}/empresas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresas_ids: empresasEdicao }),
      });
      if (resposta.ok) {
        setMensagemEdicao('Destinatários atualizados!');
        setTimeout(() => setModalAberto(false), 1500);
      } else {
        setMensagemEdicao('Erro ao salvar.');
      }
    } catch (error) {
      setMensagemEdicao('Erro de conexão.');
    }
  };

  // ================= ESTADOS DO MODAL DE STATUS =================
  const [modalStatusAberto, setModalStatusAberto] = useState(false);
  const [formStatusAtual, setFormStatusAtual] = useState(null);
  const [listaStatus, setListaStatus] = useState([]);

  const abrirModalStatus = async (form) => {
    setFormStatusAtual(form);
    setModalStatusAberto(true);
    setListaStatus([]); // Limpa a lista anterior
    
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/formularios/${form.id}/status`);
      if (resposta.ok) {
        const dados = await resposta.json();
        setListaStatus(dados);
      }
    } catch (error) {
      console.error("Erro ao buscar status");
    }
  };

  // --- NOVAS FUNÇÕES DE EXCLUSÃO ---
  const handleExcluirEmpresa = async (id, nome) => {
    if (!window.confirm(`ATENÇÃO: Deseja realmente excluir a empresa ${nome}?\nIsso apagará o acesso dela ao sistema.`)) return;
    
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/empresas/${id}`, { method: 'DELETE' });
      if (resposta.ok) {
        carregarEmpresas();
      } else {
        alert("Erro ao excluir a empresa.");
      }
    } catch (error) {
      alert("Erro de conexão com o servidor.");
    }
  };

  const handleExcluirFormulario = async (id, titulo) => {
    if (!window.confirm(`ATENÇÃO: Deseja realmente excluir o formulário "${titulo}"?\nEle sumirá do painel de todos os empresários.`)) return;
    
    try {
      const resposta = await fetch(`http://localhost:8000/api/admin/formularios/${id}`, { method: 'DELETE' });
      if (resposta.ok) {
        carregarFormularios();
      } else {
        alert("Erro ao excluir o formulário.");
      }
    } catch (error) {
      alert("Erro de conexão com o servidor.");
    }
  };

  // Funções de Selecionar Todas
  const lidarComSelecionarTodasCriacao = (e) => {
    if (e.target.checked) setEmpresasSelecionadas(listaEmpresas.map(emp => emp.id));
    else setEmpresasSelecionadas([]);
  };

  const lidarComSelecionarTodasEdicao = (e) => {
    if (e.target.checked) setEmpresasEdicao(listaEmpresas.map(emp => emp.id));
    else setEmpresasEdicao([]);
  };

  const lidarComSelecionarTodasScraping = (e) => {
    if (e.target.checked) setEmpresasScraping(listaEmpresas.map(emp => emp.id));
    else setEmpresasScraping([]);
  };

  const handleSalvarConfigScraping = async (e) => {
    e.preventDefault();
    setMensagemScraping('Salvando configurações...');
    
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/scraping/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repetir_a_cada: parseInt(repetirACada),
          unidade_tempo: unidadeTempo,
          dias_semana: diasSelecionados,
          dia_mes: parseInt(diaDoMes),
          empresas_ids: empresasScraping
        }),
      });
      
      const dados = await resposta.json();
      if (resposta.ok) {
        setMensagemScraping(dados.mensagem);
        // Remove a mensagem verde depois de 3 segundos
        setTimeout(() => setMensagemScraping(''), 3000);
      } else {
        setMensagemScraping('Erro ao salvar configurações.');
      }
    } catch (error) {
      setMensagemScraping('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 relative">
      {/* Modal de Edição (Mantido Igual) */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[500px] max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Gerenciar Destinatários</h2>
            <p className="text-gray-600 text-sm mb-4">Quem pode responder: <strong>{formSendoEditado?.titulo}</strong></p>
            <div className="mb-2 pb-2 border-b">
              <label className="flex items-center space-x-2 cursor-pointer font-semibold text-blue-900">
                <input type="checkbox" className="rounded text-blue-600" checked={empresasEdicao.length === listaEmpresas.length && listaEmpresas.length > 0} onChange={lidarComSelecionarTodasEdicao} />
                <span>Selecionar Todas as Empresas</span>
              </label>
            </div>
            <div className="flex-1 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 space-y-2 mb-4">
              {listaEmpresas.map((emp) => (
                <label key={emp.id} className="flex items-center space-x-2 cursor-pointer">
                  <input type="checkbox" className="rounded text-blue-600" checked={empresasEdicao.includes(emp.id)} onChange={(e) => {
                      if (e.target.checked) setEmpresasEdicao([...empresasEdicao, emp.id]);
                      else setEmpresasEdicao(empresasEdicao.filter(id => id !== emp.id));
                    }} />
                  <span className="text-sm text-gray-800">{emp.nome}</span>
                </label>
              ))}
            </div>
            {mensagemEdicao && <p className="text-center font-semibold text-green-700 mb-2">{mensagemEdicao}</p>}
            <div className="flex justify-end space-x-2">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold">Cancelar</button>
              <button onClick={salvarEdicaoDestinatarios} className="px-4 py-2 bg-blue-900 text-white rounded font-semibold">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DE STATUS ================= */}
      {modalStatusAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-[600px] max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Status de Respostas</h2>
            <p className="text-gray-600 text-sm mb-4 border-b pb-4">
              Formulário: <strong>{formStatusAtual?.titulo}</strong>
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {listaStatus.length === 0 ? (
                <p className="text-center text-gray-500 italic mt-4">Nenhuma empresa vinculada a este formulário.</p>
              ) : (
                listaStatus.map((item, index) => (
                  <div key={index} className="flex justify-between items-center p-3 border rounded bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800">{item.nome_empresa}</p>
                      <p className="text-xs text-gray-500">CNPJ: {item.cnpj || "Não cadastrado"}</p>
                    </div>
                    <div>
                      {item.respondido ? (
                        <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-bold border border-green-200">
                          ✅ Concluído
                        </span>
                      ) : (
                        <span className="bg-red-100 text-red-800 text-xs px-3 py-1 rounded-full font-bold border border-red-200">
                          ⏳ Pendente
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => setModalStatusAberto(false)} 
                className="px-6 py-2 bg-blue-900 text-white rounded font-semibold hover:bg-blue-800"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ============================================================= */}

      {/* Menu Lateral */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-blue-800">Painel Admin</div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setAbaAtiva('empresas')} className={`w-full text-left p-2 rounded ${abaAtiva === 'empresas' ? 'bg-blue-800 font-semibold' : 'hover:bg-blue-800'}`}>Gerenciar Empresas</button>
          <button onClick={() => setAbaAtiva('formularios')} className={`w-full text-left p-2 rounded ${abaAtiva === 'formularios' ? 'bg-blue-800 font-semibold' : 'hover:bg-blue-800'}`}>Meus Formulários</button>
          <button onClick={() => setAbaAtiva('scraping')} className={`w-full text-left p-2 rounded ${abaAtiva === 'scraping' ? 'bg-blue-800 font-semibold' : 'hover:bg-blue-800'}`}>
            Robô de Dados (Scraping)
          </button>
        </nav>
        <button onClick={sair} className="p-4 bg-red-600 hover:bg-red-700 font-bold">Sair</button>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* ================= ABA EMPRESAS ================= */}
        {abaAtiva === 'empresas' && (
          <div className="relative">
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Empresas</h1>
            
            {/* NOVO: Modal Flutuante de Edição de Empresa */}
            {modalEdicaoEmpresaAberto && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                <div className="bg-white p-6 rounded-lg shadow-xl w-[500px]">
                  <h2 className="text-xl font-bold text-gray-800 mb-4">Editar Empresa</h2>
                  <form onSubmit={handleSalvarEdicaoEmpresa} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium">Nome da Empresa</label>
                      <input type="text" value={editNome} onChange={(e) => setEditNome(e.target.value)} required className="mt-1 w-full rounded border p-2"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">CNPJ</label>
                      <input type="text" value={editCnpj} onChange={(e) => setEditCnpj(e.target.value)} className="mt-1 w-full rounded border p-2"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium">E-mail</label>
                      <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required className="mt-1 w-full rounded border p-2"/>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-blue-800">Link do Booking (Para o Robô)</label>
                      <input type="url" value={editUrlBooking} onChange={(e) => setEditUrlBooking(e.target.value)} placeholder="https://www.booking.com/hotel/..." className="mt-1 w-full rounded border border-blue-300 bg-blue-50 p-2"/>
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <button type="button" onClick={() => setModalEdicaoEmpresaAberto(false)} className="px-4 py-2 bg-gray-300 rounded font-semibold">Cancelar</button>
                      <button type="submit" className="px-4 py-2 bg-blue-900 text-white rounded font-semibold">Salvar Alterações</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Bloco de Cadastro */}
            <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-4xl">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Cadastrar Nova Empresa</h2>
              <form onSubmit={handleCadastrarEmpresa} className="space-y-4">
                {erroEmpresa && <div className="p-3 bg-red-100 text-red-700 rounded border">{erroEmpresa}</div>}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Nome</label>
                    <input type="text" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required className="mt-1 w-full rounded border p-2"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">CNPJ</label>
                    <input type="text" value={cnpjEmpresa} onChange={(e) => setCnpjEmpresa(e.target.value)} required className="mt-1 w-full rounded border p-2"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">E-mail</label>
                    <input type="email" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} required className="mt-1 w-full rounded border p-2"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-blue-800">Link do Booking</label>
                    <input type="url" value={urlBookingEmpresa} onChange={(e) => setUrlBookingEmpresa(e.target.value)} className="mt-1 w-full rounded border border-blue-300 bg-blue-50 p-2" placeholder="Opcional"/>
                  </div>
                </div>
                <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded font-semibold hover:bg-blue-800">Cadastrar Empresa</button>
              </form>
            </div>

            {/* (Mantenha os alertas verde e azul de senha gerada/resetada que você já tinha aqui) */}
            
            {senhaGerada && (
              <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg shadow max-w-2xl">
                <h3 className="text-lg font-bold text-green-800">🎉 Empresa cadastrada com sucesso!</h3>
                <p className="mt-2 text-gray-800"><strong>Usuário:</strong> {emailCadastrado}</p>
                <p className="text-xl mt-2 text-gray-800"><strong>Senha:</strong> <span className="bg-yellow-200 px-2 py-1 rounded">{senhaGerada}</span></p>
              </div>
            )}

            {senhaResetada && (
              <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg shadow max-w-2xl">
                <h3 className="text-lg font-bold text-blue-800">🔄 Senha de {empresaResetada} resetada!</h3>
                <p className="text-xl mt-2 text-gray-800"><strong>Nova Senha Provisória:</strong> <span className="bg-yellow-200 px-2 py-1 rounded">{senhaResetada}</span></p>
              </div>
            )}

            {/* Tabela de Empresas */}
            <div className="mt-8 bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Booking</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {listaEmpresas.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.nome} <br/><span className="text-xs text-gray-500 font-normal">{emp.email}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.cnpj || '-'}</td>
                      
                      {/* Ícone de check se a empresa tiver URL cadastrada */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {emp.url_booking ? (
                          <span className="text-green-600 font-bold" title="URL Configurada">✓ Sim</span>
                        ) : (
                          <span className="text-red-400 text-xs" title="URL Pendente">Falta link</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <button onClick={() => abrirModalEdicaoEmpresa(emp)} className="text-orange-600 hover:text-orange-900 font-bold">Editar Dados</button>
                        <button onClick={() => handleResetarSenha(emp.id, emp.nome)} className="text-blue-600 hover:text-blue-900">Resetar Senha</button>
                        <button onClick={() => handleExcluirEmpresa(emp.id, emp.nome)} className="text-red-600 hover:text-red-900 font-bold">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================= ABA FORMULÁRIOS ================= */}
        {abaAtiva === 'formularios' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Meus Formulários</h1>
            <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Novo Formulário</h2>
              <form onSubmit={handleCadastrarFormulario} className="space-y-4">
                {erroForm && <div className="p-3 bg-red-100 text-red-700 rounded border">{erroForm}</div>}
                {mensagemForm && <div className="p-3 bg-green-100 text-green-700 rounded border">{mensagemForm}</div>}
                <div>
                  <label className="block text-sm font-medium">Título</label>
                  <input type="text" value={tituloForm} onChange={(e) => setTituloForm(e.target.value)} required className="mt-1 block w-full rounded border p-2"/>
                </div>
                <div>
                  <label className="block text-sm font-medium">Descrição (Opcional)</label>
                  <textarea value={descricaoForm} onChange={(e) => setDescricaoForm(e.target.value)} className="mt-1 block w-full rounded border p-2"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium">Link do Google Forms</label>
                  <input type="url" value={urlForm} onChange={(e) => setUrlForm(e.target.value)} required className="mt-1 block w-full rounded border p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Destinar a quais empresas?</label>
                  <div className="mb-2 pb-2 border-b">
                    <label className="flex items-center space-x-2 cursor-pointer font-semibold text-blue-900">
                      <input type="checkbox" className="rounded text-blue-600" checked={empresasSelecionadas.length === listaEmpresas.length && listaEmpresas.length > 0} onChange={lidarComSelecionarTodasCriacao} />
                      <span>Selecionar Todas as Empresas</span>
                    </label>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 space-y-2">
                    {listaEmpresas.map((emp) => (
                      <label key={emp.id} className="flex items-center space-x-2 cursor-pointer">
                        <input type="checkbox" className="rounded text-blue-600" checked={empresasSelecionadas.includes(emp.id)} onChange={(e) => {
                            if (e.target.checked) setEmpresasSelecionadas([...empresasSelecionadas, emp.id]);
                            else setEmpresasSelecionadas(empresasSelecionadas.filter(id => id !== emp.id));
                          }} />
                        <span className="text-sm text-gray-800">{emp.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded font-semibold hover:bg-blue-800">Vincular Formulário</button>
              </form>
            </div>

            <div className="mt-8 bg-white rounded-lg shadow overflow-hidden max-w-4xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Título</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {listaFormularios.map((form) => (
                    <tr key={form.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{form.titulo}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button onClick={() => abrirModalStatus(form)} className="text-green-600 hover:text-green-900 font-bold">Acompanhar Status</button>
                        <button onClick={() => abrirModalEdicao(form)} className="text-blue-600 hover:text-blue-900">Gerenciar Acessos</button>
                        <button onClick={() => handleExcluirFormulario(form.id, form.titulo)} className="text-red-600 hover:text-red-900 font-bold">Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* ================= ABA DE SCRAPING ================= */}
        {abaAtiva === 'scraping' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Automação de Web Scraping</h1>
            <p className="text-gray-600 mt-2">
              Busca automática de dados no Booking.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
              
              {/* COLUNA ESQUERDA: CONFIGURAÇÕES */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold text-gray-800 mb-6 border-b pb-2">Agendamento do Robô</h2>
                
                <form onSubmit={handleSalvarConfigScraping} className="space-y-6">
                  
                  {/* CALENDÁRIO */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Frequência de Execução</label>
                    <div className="flex items-center space-x-3 mb-4 bg-gray-50 p-4 rounded border">
                      <span className="text-gray-800 font-medium">Repetir a cada:</span>
                      <input 
                        type="number" min="1" value={repetirACada} onChange={(e) => setRepetirACada(e.target.value)}
                        className="w-16 border border-gray-400 rounded p-1 text-center"
                      />
                      <select 
                        value={unidadeTempo} onChange={(e) => setUnidadeTempo(e.target.value)}
                        className="border border-gray-400 rounded p-1"
                      >
                        <option value="dia">dia(s)</option>
                        <option value="semana">semana(s)</option>
                        <option value="mes">mês(es)</option>
                      </select>
                    </div>

                    {unidadeTempo === 'semana' && (
                      <div className="bg-gray-50 p-4 rounded border mt-2">
                        <span className="text-gray-800 font-medium block mb-3">Dias da Semana:</span>
                        <div className="flex space-x-2">
                          {diasSemana.map((dia) => (
                            <button
                              key={dia.id}
                              type="button"
                              onClick={() => setDiasSelecionados(diasSelecionados.includes(dia.id) 
                                ? diasSelecionados.filter(d => d !== dia.id) 
                                : [...diasSelecionados, dia.id])}
                              className={`w-10 h-10 rounded-full font-bold transition-colors flex items-center justify-center
                                ${diasSelecionados.includes(dia.id) ? 'bg-blue-600 text-white shadow' : 'bg-gray-300 text-gray-700 hover:bg-gray-400'}`}
                            >
                              {dia.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {unidadeTempo === 'mes' && (
                      <div className="bg-gray-50 p-4 rounded border mt-2">
                        <span className="text-gray-800 font-medium block mb-3">Dia do Mês:</span>
                        <select 
                          value={diaDoMes} 
                          onChange={(e) => setDiaDoMes(e.target.value)}
                          className="border border-gray-400 rounded p-2 bg-white w-full max-w-[200px]"
                        >
                          {/* Gera opções do dia 1 ao 31 automaticamente */}
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(dia => (
                            <option key={dia} value={dia}>Dia {dia}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-2 italic">
                          *Se o mês escolhido não tiver este dia (ex: 31 de fevereiro), o robô rodará automaticamente no último dia disponível do mês.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* SELEÇÃO DE EMPRESAS */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monitorar quais empresas no Booking?</label>
                    <div className="mb-2 pb-2 border-b">
                      <label className="flex items-center space-x-2 cursor-pointer font-semibold text-blue-900">
                        <input type="checkbox" className="rounded text-blue-600" checked={empresasScraping.length === listaEmpresas.length && listaEmpresas.length > 0} onChange={lidarComSelecionarTodasScraping} />
                        <span>Selecionar Todas as Empresas</span>
                      </label>
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 space-y-2">
                      {listaEmpresas.map((emp) => (
                        <label key={emp.id} className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" className="rounded text-blue-600" checked={empresasScraping.includes(emp.id)} onChange={(e) => {
                              if (e.target.checked) setEmpresasScraping([...empresasScraping, emp.id]);
                              else setEmpresasScraping(empresasScraping.filter(id => id !== emp.id));
                            }} />
                          <span className="text-sm text-gray-800">{emp.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {mensagemScraping && <div className="p-3 bg-green-100 text-green-700 rounded border font-semibold">{mensagemScraping}</div>}

                  <button type="submit" className="w-full bg-blue-900 text-white px-4 py-3 rounded-md font-bold hover:bg-blue-800 shadow-md">
                    Salvar Configurações do Robô
                  </button>
                </form>
              </div>

              {/* COLUNA DIREITA: LOGS E STATUS */}
              <div>
                <div className="bg-white p-6 rounded-lg shadow mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">Status do Serviço</h2>
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-semibold text-gray-700">Robô Ativo (Aguardando próximo ciclo)</span>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Últimas Execuções (Logs)</h2>
                  </div>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data/Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {logsScraping.map((log) => (
                        <tr key={log.id}>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.data}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs font-bold rounded-full ${log.status === 'Sucesso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">{log.detalhes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}