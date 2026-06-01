import string
import secrets
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
import psycopg2
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_CONFIG = {
    "dbname": "olimpia_turismo",
    "user": "postgres",
    "password": "chimbica",
    "host": "localhost",
    "port": "5432"
}

# Permite que o frontend do React (porta 5173) converse com esta API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Função para gerar a senha aleatória temporária
def gerar_senha_aleatoria(tamanho=8):
    caracteres = string.ascii_letters + string.digits + "!@#$"
    return ''.join(secrets.choice(caracteres) for _ in range(tamanho))

# Modelos de dados para as requisições
class LoginRequest(BaseModel):
    email: str
    senha: str

class EmpresaCadastro(BaseModel):
    nome: str
    email: str

class ResetSenhaRequest(BaseModel):
    usuario_id: int

class AlterarSenhaRequest(BaseModel):
    usuario_id: int
    senha_atual: str
    nova_senha: str

# ----------------------------------------------------
# 0. ROTA DE LOGIN
# ----------------------------------------------------
@app.post("/api/login")
def login(dados: LoginRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        cursor.execute("SELECT id, nome, senha, role FROM usuarios WHERE email = %s", (dados.email,))
        usuario = cursor.fetchone()
        
        cursor.close()
        conexao.close()
        
        if not usuario:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
            
        db_id, db_nome, db_senha, db_role = usuario
        
        # Como o admin foi criado com senha em texto puro no primeiro teste
        # e as empresas terão senha criptografada pelo bcrypt, fazemos dupla checagem
        senha_valida = False
        if db_senha.startswith('$2b$'): # É um hash do bcrypt
            senha_valida = pwd_context.verify(dados.senha, db_senha)
        else: # É texto puro
            senha_valida = (dados.senha == db_senha)
            
        if not senha_valida:
            raise HTTPException(status_code=401, detail="E-mail ou senha incorretos")
            
        return {
            "status": "Sucesso",
            "nome": db_nome,
            "role": db_role,
            "usuario_id": db_id
        }
        
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Erro no banco de dados: {str(e)}")

# ----------------------------------------------------
# 1. ROTA DE CADASTRO (Gera a primeira senha)
# ----------------------------------------------------
@app.post("/api/admin/cadastrar-empresa")
def cadastrar_empresa(empresa: EmpresaCadastro):
    senha_provisoria = gerar_senha_aleatoria()
    senha_criptografada = pwd_context.hash(senha_provisoria)
    
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        cursor.execute(
            "INSERT INTO usuarios (nome, email, senha, role) VALUES (%s, %s, %s, 'empresario')",
            (empresa.nome, empresa.email, senha_criptografada)
        )
        conexao.commit()
        cursor.close()
        conexao.close()
        
        # Retorna a senha gerada para o Admin ver na tela
        return {
            "status": "Sucesso",
            "mensagem": "Empresa cadastrada com sucesso!",
            "senha_gerada": senha_provisoria 
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado no sistema.")

# ----------------------------------------------------
# 2. ROTA DE RESET (Gera uma nova senha se esquecerem)
# ----------------------------------------------------
@app.put("/api/admin/resetar-senha")
def resetar_senha(request: ResetSenhaRequest):
    nova_senha_provisoria = gerar_senha_aleatoria()
    nova_senha_criptografada = pwd_context.hash(nova_senha_provisoria)
    
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Verifica se o usuário existe antes de atualizar
        cursor.execute("SELECT id FROM usuarios WHERE id = %s AND role = 'empresario'", (request.usuario_id,))
        if not cursor.fetchone():
            cursor.close()
            conexao.close()
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        
        # Atualiza o hash da senha no banco de dados
        cursor.execute("UPDATE usuarios SET senha = %s WHERE id = %s", (nova_senha_criptografada, request.usuario_id))
        conexao.commit()
        
        cursor.close()
        conexao.close()
        
        # Retorna a nova senha gerada
        return {
            "status": "Sucesso",
            "mensagem": "Senha resetada com sucesso!",
            "nova_senha_gerada": nova_senha_provisoria 
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")
    
# ----------------------------------------------------
# 3. ROTA PARA LISTAR EMPRESAS (Para o painel do Admin)
# ----------------------------------------------------
@app.get("/api/admin/empresas")
def listar_empresas():
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Busca todas as contas que são de empresários
        cursor.execute("SELECT id, nome, email FROM usuarios WHERE role = 'empresario' ORDER BY id DESC")
        empresas = [{"id": linha[0], "nome": linha[1], "email": linha[2]} for linha in cursor.fetchall()]
        
        cursor.close()
        conexao.close()
        return empresas
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao buscar lista de empresas.")

# ----------------------------------------------------
# 4. ROTA DE ALTERAR A PRÓPRIA SENHA (Para o Empresário)
# ----------------------------------------------------
@app.put("/api/usuarios/alterar-senha")
def alterar_senha(dados: AlterarSenhaRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Busca a senha atual criptografada no banco
        cursor.execute("SELECT senha FROM usuarios WHERE id = %s", (dados.usuario_id,))
        usuario = cursor.fetchone()
        
        if not usuario:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            
        db_senha = usuario[0]
        
        # Verifica se a senha antiga digitada confere com a do banco
        senha_valida = False
        if db_senha.startswith('$2b$'):
            senha_valida = pwd_context.verify(dados.senha_atual, db_senha)
        else:
            senha_valida = (dados.senha_atual == db_senha)
            
        if not senha_valida:
            raise HTTPException(status_code=400, detail="A senha atual está incorreta.")
            
        # Criptografa a senha nova e atualiza
        nova_senha_criptografada = pwd_context.hash(dados.nova_senha)
        cursor.execute("UPDATE usuarios SET senha = %s WHERE id = %s", (nova_senha_criptografada, dados.usuario_id))
        conexao.commit()
        
        cursor.close()
        conexao.close()
        return {"status": "Sucesso", "mensagem": "Senha alterada com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))