import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmpresarioDashboard() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  // Estado para controlar a aba ativa no menu lateral
  const [abaAtiva, setAbaAtiva] = useState('formularios'); // 'formularios' ou 'senha'

  // ================= ESTADOS DE FORMULÁRIOS =================
  const [listaFormularios, setListaFormularios] = useState([]);
  const [formularioSelecionado, setFormularioSelecionado] = useState(null);

  // ================= ESTADOS DE SENHA =================
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mensagemSenha, setMensagemSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');

  const sair = () => {
    localStorage.removeItem('usuario');
    navigate('/');
  };

  // Carrega os formulários assim que a página abre
  useEffect(() => {
    carregarFormularios();
  }, []);

  const carregarFormularios = async () => {
    try {
      // Adicionamos o ?usuario_id= na URL
      const resposta = await fetch(`http://localhost:8000/api/formularios?usuario_id=${usuario.usuario_id}`);
      if (resposta.ok) {
        const dados = await resposta.json();
        setListaFormularios(dados);
      }
    } catch (error) {
      console.error("Erro ao carregar formulários", error);
    }
  };

  const marcarComoRespondido = async (formulario_id) => {
    if (!window.confirm("Confirmar que você já enviou suas respostas no formulário do Google?")) return;
    
    try {
      const resposta = await fetch(`http://localhost:8000/api/formularios/${formulario_id}/responder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: usuario.usuario_id })
      });
      
      if (resposta.ok) {
        alert("Obrigado! Formulário marcado como concluído.");
        setFormularioSelecionado(null); // Fecha o iframe
        carregarFormularios(); // Atualiza a lista para mover o form para "Concluídos"
      }
    } catch (error) {
      alert("Erro ao conectar com o servidor.");
    }
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setErroSenha(''); setMensagemSenha('');

    if (novaSenha !== confirmarSenha) {
      setErroSenha('A nova senha e a confirmação não são iguais.');
      return;
    }

    try {
      const resposta = await fetch('http://localhost:8000/api/usuarios/alterar-senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuario.usuario_id,
          senha_atual: senhaAtual,
          nova_senha: novaSenha
        }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagemSenha(dados.mensagem);
        setSenhaAtual(''); setNovaSenha(''); setConfirmarSenha('');
      } else {
        setErroSenha(dados.detail || 'Erro ao alterar senha.');
      }
    } catch (error) {
      setErroSenha('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Menu Lateral */}
      <aside className="w-64 bg-green-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-green-800">Painel da Empresa</div>
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => { setAbaAtiva('formularios'); setFormularioSelecionado(null); }}
            className={`w-full text-left p-2 rounded ${abaAtiva === 'formularios' ? 'bg-green-800 font-semibold' : 'hover:bg-green-800'}`}
          >
            Preencher Formulários
          </button>
          <button 
            onClick={() => setAbaAtiva('senha')}
            className={`w-full text-left p-2 rounded ${abaAtiva === 'senha' ? 'bg-green-800 font-semibold' : 'hover:bg-green-800'}`}
          >
            Alterar Senha
          </button>
        </nav>
        <button onClick={sair} className="p-4 bg-red-600 hover:bg-red-700 text-center font-bold">Sair</button>
      </aside>

      {/* Área Principal Dinâmica */}
      <main className="flex-1 p-8 overflow-y-auto">
        
        {/* ================= ABA FORMULÁRIOS ================= */}
        {abaAtiva === 'formularios' && (
          <div>
            <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-600 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
              <div className="max-w-2xl">
                <h1 className="text-3xl font-bold text-gray-800">Olá, {usuario?.nome}! 👋</h1>
                <p className="text-gray-600 mt-2">
                  Bem-vindo ao Portal do <strong>Observatório de Turismo de Olímpia</strong>. 
                  Sua contribuição é fundamental para o desenvolvimento e monitoramento do setor turístico de nossa cidade. 
                  Por favor, mantenha seus formulários de inventário atualizados.
                </p>
              </div>
              
              <div className="mt-4 md:mt-0 bg-gray-50 p-4 rounded border text-sm text-gray-700 min-w-[250px]">
                <p className="font-bold text-gray-900 mb-1 border-b pb-1">Identificação da Empresa</p>
                <p><span className="font-semibold">Razão:</span> {usuario?.nome}</p>
                <p><span className="font-semibold">CNPJ:</span> {usuario?.cnpj || "Não informado"}</p>
                <p><span className="font-semibold">E-mail:</span> {usuario?.email}</p>
              </div>
            </div>
                      
            {!formularioSelecionado ? (
              <div className="mt-8 space-y-8">
                
                {/* SESSÃO: PENDENTES */}
                <div>
                  <h2 className="text-xl font-bold text-red-700 mb-4 flex items-center">
                    <span className="w-3 h-3 bg-red-600 rounded-full mr-2 animate-pulse"></span>
                    Pendentes ({listaFormularios.filter(f => !f.respondido).length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listaFormularios.filter(f => !f.respondido).map((form) => (
                      <div key={form.id} className="bg-white p-6 rounded-lg shadow border-t-4 border-red-600 flex flex-col">
                        <h3 className="text-xl font-bold text-gray-800">{form.titulo}</h3>
                        <p className="text-gray-600 mt-2 flex-1">{form.descricao || "Sem descrição."}</p>
                        <button 
                          onClick={() => setFormularioSelecionado(form)}
                          className="mt-4 w-full bg-red-700 text-white py-2 rounded font-semibold hover:bg-red-800 transition"
                        >
                          Responder Agora
                        </button>
                      </div>
                    ))}
                    {listaFormularios.filter(f => !f.respondido).length === 0 && (
                      <p className="text-gray-500 italic">Nenhum formulário pendente no momento.</p>
                    )}
                  </div>
                </div>

                {/* SESSÃO: CONCLUÍDOS */}
                <div>
                  <h2 className="text-xl font-bold text-green-700 mb-4 border-t pt-8">
                    Concluídos ({listaFormularios.filter(f => f.respondido).length})
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {listaFormularios.filter(f => f.respondido).map((form) => (
                      <div key={form.id} className="bg-gray-50 p-6 rounded-lg shadow border-t-4 border-green-600 opacity-75">
                        <h3 className="text-lg font-bold text-gray-600">{form.titulo}</h3>
                        <p className="text-sm text-green-700 mt-2 font-semibold">✓ Respondido</p>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              /* TELA DO IFRAME (Respondendo) */
              <div className="mt-8 flex flex-col h-[85vh]">
                <div className="flex justify-between items-center mb-4 bg-white p-4 rounded shadow">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Preenchendo: {formularioSelecionado.titulo}</h2>
                    <p className="text-sm text-gray-600">Após enviar o formulário abaixo, clique no botão verde para confirmar.</p>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => setFormularioSelecionado(null)}
                      className="bg-gray-300 text-gray-800 px-4 py-2 rounded font-semibold hover:bg-gray-400"
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={() => marcarComoRespondido(formularioSelecionado.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded font-semibold hover:bg-green-700 shadow-lg animate-bounce"
                    >
                      Já respondi! (Concluir)
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
                  <iframe 
                    src={formularioSelecionado.url_google_forms} 
                    className="w-full h-full border-0"
                    title="Google Forms"
                  ></iframe>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= ABA ALTERAR SENHA ================= */}
        {abaAtiva === 'senha' && (
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Segurança da Conta</h1>
            
            <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Alterar Minha Senha</h2>
              <form onSubmit={handleAlterarSenha} className="space-y-4">
                {erroSenha && <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">{erroSenha}</div>}
                {mensagemSenha && <div className="p-3 bg-green-100 text-green-700 rounded border border-green-200">{mensagemSenha}</div>}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Senha Atual</label>
                  <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nova Senha</label>
                  <input type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
                  <input type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border" />
                </div>
                <button type="submit" className="w-full bg-green-900 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-800 transition">
                  Atualizar Senha
                </button>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}