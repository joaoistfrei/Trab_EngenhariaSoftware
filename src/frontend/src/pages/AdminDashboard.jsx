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
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [emailCadastrado, setEmailCadastrado] = useState('');
  const [mensagemEmpresa, setMensagemEmpresa] = useState('');
  const [erroEmpresa, setErroEmpresa] = useState('');
  const [listaEmpresas, setListaEmpresas] = useState([]);
  const [senhaResetada, setSenhaResetada] = useState(null);
  const [empresaResetada, setEmpresaResetada] = useState('');

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
        body: JSON.stringify({ nome: nomeEmpresa, email: emailEmpresa, cnpj: cnpjEmpresa }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        setMensagemEmpresa(dados.mensagem);
        setSenhaGerada(dados.senha_gerada); setEmailCadastrado(emailEmpresa);
        setNomeEmpresa(''); setEmailEmpresa(''); setCnpjEmpresa('');
        carregarEmpresas();
      } else {
        setErroEmpresa(dados.detail || 'Erro ao cadastrar.');
      }
    } catch (error) {
      setErroEmpresa('Erro de conexão.');
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
        </nav>
        <button onClick={sair} className="p-4 bg-red-600 hover:bg-red-700 font-bold">Sair</button>
      </aside>

      {/* Área Principal */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* ================= ABA EMPRESAS ================= */}
        {abaAtiva === 'empresas' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Gerenciar Empresas</h1>
            <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Cadastrar Nova Empresa</h2>
              <form onSubmit={handleCadastrarEmpresa} className="space-y-4">
                {erroEmpresa && <div className="p-3 bg-red-100 text-red-700 rounded border">{erroEmpresa}</div>}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium">Nome</label>
                    <input type="text" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required className="mt-1 block w-full rounded border p-2"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">CNPJ</label>
                    <input type="text" value={cnpjEmpresa} onChange={(e) => setCnpjEmpresa(e.target.value)} required className="mt-1 block w-full rounded border p-2" placeholder="00.000.000/0000-00"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium">E-mail</label>
                    <input type="email" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} required className="mt-1 block w-full rounded border p-2"/>
                  </div>
                </div>
                <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded font-semibold hover:bg-blue-800">Cadastrar Empresa</button>
              </form>
            </div>

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
                <p className="mt-2 text-gray-800">Copie a nova senha abaixo e envie para a empresa.</p>
                <p className="text-xl mt-2 text-gray-800">
                  <strong>Nova Senha Provisória:</strong> <span className="bg-yellow-200 px-2 py-1 rounded">{senhaResetada}</span>
                </p>
              </div>
            )}

            <div className="mt-8 bg-white rounded-lg shadow overflow-hidden max-w-4xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">CNPJ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-mail</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {listaEmpresas.map((emp) => (
                    <tr key={emp.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.nome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.cnpj || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                        <button onClick={() => handleResetarSenha(emp.id, emp.nome)} className="text-blue-600 hover:text-blue-900">Resetar Senha</button>
                        {/* NOVO BOTÃO DE EXCLUIR AQUI */}
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

      </main>
    </div>
  );
}