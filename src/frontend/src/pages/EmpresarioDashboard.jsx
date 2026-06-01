import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function EmpresarioDashboard() {
  const navigate = useNavigate();
  const usuario = JSON.parse(localStorage.getItem('usuario'));

  // Estados do formulário de alterar senha
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');

  const sair = () => {
    localStorage.removeItem('usuario');
    navigate('/');
  };

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');

    if (novaSenha !== confirmarSenha) {
      setErro('A nova senha e a confirmação não são iguais.');
      return;
    }

    try {
      const resposta = await fetch('http://localhost:8000/api/usuarios/alterar-senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario_id: usuario.usuario_id, // Pega o ID de quem está logado
          senha_atual: senhaAtual,
          nova_senha: novaSenha
        }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        setMensagem(dados.mensagem);
        setSenhaAtual('');
        setNovaSenha('');
        setConfirmarSenha('');
      } else {
        setErro(dados.detail || 'Erro ao alterar senha.');
      }
    } catch (error) {
      setErro('Erro de conexão com o servidor.');
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-green-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-green-800">Painel da Empresa</div>
        <nav className="flex-1 p-4 space-y-2">
          <button className="w-full text-left p-2 hover:bg-green-800 rounded">Preencher Formulários</button>
          <button className="w-full text-left p-2 bg-green-800 rounded font-semibold">Alterar Senha</button>
        </nav>
        <button onClick={sair} className="p-4 bg-red-600 hover:bg-red-700 text-center font-bold">Sair</button>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        <h1 className="text-3xl font-bold text-gray-800">Bem-vindo, {usuario?.nome}</h1>
        
        <div className="mt-8 bg-white p-6 rounded-lg shadow max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Alterar Minha Senha</h2>
          
          <form onSubmit={handleAlterarSenha} className="space-y-4">
            {erro && <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">{erro}</div>}
            {mensagem && <div className="p-3 bg-green-100 text-green-700 rounded border border-green-200">{mensagem}</div>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Senha Atual</label>
              <input 
                type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)} required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nova Senha</label>
              <input 
                type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
              <input 
                type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 p-2 border"
              />
            </div>
            <button type="submit" className="w-full bg-green-900 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-800 transition">
              Atualizar Senha
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}