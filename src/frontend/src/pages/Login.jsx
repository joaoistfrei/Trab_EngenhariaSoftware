import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  // 1. Estados para guardar o que o usuário digita
  const [identificacao, setIdentificacao] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate(); // Ferramenta para mudar de página

  // 2. Função que roda quando o botão "Entrar" é clicado
  const handleLogin = async (e) => {
    e.preventDefault(); // Impede a página de recarregar
    setErro(''); // Limpa erros antigos

    try {
      // Faz a chamada para a sua API em Python
      const resposta = await fetch('http://localhost:8000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificacao, senha }),
      });

      const dados = await resposta.json();

      if (resposta.ok) {
        // Salva os dados do usuário no navegador
        localStorage.setItem('usuario', JSON.stringify(dados));
        
        // Redireciona dependendo do nível de acesso (Role)
        if (dados.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/empresario');
        }
      } else {
        // Mostra a mensagem de erro que veio lá do Python (ex: "Senha incorreta")
        setErro(dados.detail || 'Erro ao fazer login.');
      }
    } catch (error) {
      setErro('Erro de conexão com o servidor. O servidor Python está rodando?');
    }
  };

  // 3. A parte visual (Interface)
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h2 className="text-2xl font-bold text-center text-blue-900 mb-6">
          Portal de Turismo de Olímpia
        </h2>
        
        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Alerta vermelho se der erro */}
          {erro && (
            <div className="bg-red-100 text-red-700 p-2 text-sm rounded border border-red-200 text-center">
              {erro}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">E-mail ou CNPJ</label>
            <input 
              type="text" 
              value={identificacao}
              onChange={(e) => setIdentificacao(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="exemplo@email.com ou 00.000.000/0000-00"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha</label>
            <input 
              type="password" 
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-2 border"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full bg-blue-900 text-white p-2 rounded-md font-semibold hover:bg-blue-800 transition"
          >
            Entrar
          </button>
        </form>
        
        <p className="text-xs text-center text-gray-500 mt-4">
          Esqueceu-se da sua senha? Contacte o Observatório para redefinição.
        </p>
      </div>
    </div>
  );
}