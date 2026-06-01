import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  // Estados de Cadastro
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [emailEmpresa, setEmailEmpresa] = useState('');
  const [senhaGerada, setSenhaGerada] = useState(null);
  const [emailCadastrado, setEmailCadastrado] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  // Estados da Lista e Reset
  const [listaEmpresas, setListaEmpresas] = useState([]);
  const [senhaResetada, setSenhaResetada] = useState(null);
  const [empresaResetada, setEmpresaResetada] = useState('');

  const sair = () => {
    localStorage.removeItem('usuario');
    navigate('/');
  };

  // Busca a lista de empresas ao abrir a página
  const carregarEmpresas = async () => {
    try {
      const resposta = await fetch('http://localhost:8000/api/admin/empresas');
      if (resposta.ok) {
        const dados = await resposta.json();
        setListaEmpresas(dados);
      }
    } catch (error) {
      console.error("Erro ao carregar lista", error);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  const handleCadastrarEmpresa = async (e) => {
    e.preventDefault();
    setErro(''); setMensagem(''); setSenhaGerada(null); setSenhaResetada(null);

    try {
      const resposta = await fetch('http://localhost:8000/api/admin/cadastrar-empresa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeEmpresa, email: emailEmpresa }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem(dados.mensagem);
        setSenhaGerada(dados.senha_gerada); 
        setEmailCadastrado(emailEmpresa); 
        setNomeEmpresa(''); setEmailEmpresa('');
        carregarEmpresas(); // Atualiza a tabela com a nova empresa
      } else {
        setErro(dados.detail || 'Erro ao cadastrar.');
      }
    } catch (error) {
      setErro('Erro de conexão com o servidor.');
    }
  };

  // Função que o Admin chama ao clicar em "Resetar Senha" na tabela
  const handleResetarSenha = async (id, nome) => {
    if (!window.confirm(`Tem certeza que deseja resetar a senha de ${nome}?`)) return;
    setSenhaGerada(null); // Esconde a mensagem de cadastro se estiver aberta
    setSenhaResetada(null);

    try {
      const resposta = await fetch('http://localhost:8000/api/admin/resetar-senha', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario_id: id }),
      });
      const dados = await resposta.json();

      if (resposta.ok) {
        setSenhaResetada(dados.nova_senha_gerada);
        setEmpresaResetada(nome);
      } else {
        alert(dados.detail || "Erro ao resetar senha");
      }
    } catch (error) {
      alert("Erro de conexão");
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-blue-800">Painel Admin</div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full text-left p-2 bg-blue-800 rounded font-semibold">Gerenciar Empresas</button>
          <button className="w-full text-left p-2 hover:bg-blue-800 rounded">Meus Formulários</button>
        </nav>
        <button onClick={sair} className="p-4 bg-red-600 hover:bg-red-700 text-center font-bold">Sair</button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-gray-800">Gerenciar Empresas</h1>
        
        {/* Formulário de Cadastro (IGUAL AO ANTERIOR) */}
        <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-2xl">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Cadastrar Nova Empresa</h2>
          <form onSubmit={handleCadastrarEmpresa} className="space-y-4">
            {erro && <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">{erro}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nome</label>
                <input type="text" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="Ex: Hotel Central"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">E-mail</label>
                <input type="email" value={emailEmpresa} onChange={(e) => setEmailEmpresa(e.target.value)} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border" placeholder="contato@empresa.com"/>
              </div>
            </div>
            <button type="submit" className="bg-blue-900 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-800">Cadastrar Empresa</button>
          </form>
        </div>

        {/* Modal Sucesso Cadastro */}
        {senhaGerada && (
          <div className="mt-6 bg-green-50 border-l-4 border-green-500 p-6 rounded-r-lg shadow max-w-2xl">
            <h3 className="text-lg font-bold text-green-800">🎉 Empresa cadastrada com sucesso!</h3>
            <p className="mt-2 text-gray-800"><strong>Usuário:</strong> {emailCadastrado}</p>
            <p className="text-xl mt-2 text-gray-800"><strong>Senha:</strong> <span className="bg-yellow-200 px-2 py-1 rounded">{senhaGerada}</span></p>
          </div>
        )}

        {/* Modal Sucesso Reset */}
        {senhaResetada && (
          <div className="mt-6 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg shadow max-w-2xl">
            <h3 className="text-lg font-bold text-blue-800">🔄 Senha de {empresaResetada} resetada!</h3>
            <p className="text-xl mt-2 text-gray-800"><strong>Nova Senha Provisória:</strong> <span className="bg-yellow-200 px-2 py-1 rounded">{senhaResetada}</span></p>
          </div>
        )}

        {/* TABELA DE EMPRESAS */}
        <div className="mt-8 bg-white rounded-lg shadow overflow-hidden max-w-4xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome da Empresa</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {listaEmpresas.map((emp) => (
                <tr key={emp.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#{emp.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.nome}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{emp.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleResetarSenha(emp.id, emp.nome)}
                      className="text-red-600 hover:text-red-900 font-semibold"
                    >
                      Resetar Senha
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}