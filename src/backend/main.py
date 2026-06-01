import string
import secrets
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
import psycopg2
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

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
    identificacao: str
    senha: str

class EmpresaCadastro(BaseModel):
    nome: str
    email: str
    cnpj: str

class ResetSenhaRequest(BaseModel):
    usuario_id: int

class AlterarSenhaRequest(BaseModel):
    usuario_id: int
    senha_atual: str
    nova_senha: str

class FormularioCadastro(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    url_google_forms: str
    empresas_ids: List[int] = []

class AtualizarDestinatariosRequest(BaseModel):
    empresas_ids: List[int]

class ResponderFormularioRequest(BaseModel):
    usuario_id: int

class ConfigScrapingRequest(BaseModel):
    repetir_a_cada: int
    unidade_tempo: str
    dias_semana: List[str] = []
    dia_mes: int = 1
    empresas_ids: List[int] = []

# ----------------------------------------------------
# 0. ROTA DE LOGIN
# ----------------------------------------------------
@app.post("/api/login")
def login(dados: LoginRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Busca por E-mail OU por CNPJ
        cursor.execute(
            "SELECT id, nome, senha, role, email, cnpj FROM usuarios WHERE email = %s OR cnpj = %s", 
            (dados.identificacao, dados.identificacao)
        )
        usuario = cursor.fetchone()
        
        cursor.close()
        conexao.close()
        
        if not usuario:
            raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
            
        db_id, db_nome, db_senha, db_role, db_email, db_cnpj = usuario
        
        senha_valida = False
        if db_senha.startswith('$2b$'):
            senha_valida = pwd_context.verify(dados.senha, db_senha)
        else:
            senha_valida = (dados.senha == db_senha)
            
        if not senha_valida:
            raise HTTPException(status_code=401, detail="Usuário ou senha incorretos")
            
        return {
            "status": "Sucesso",
            "nome": db_nome,
            "role": db_role,
            "usuario_id": db_id,
            "email": db_email,
            "cnpj": db_cnpj
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
            "INSERT INTO usuarios (nome, email, senha, role, cnpj) VALUES (%s, %s, %s, 'empresario', %s)",
            (empresa.nome, empresa.email, senha_criptografada, empresa.cnpj)
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
        cursor.execute("SELECT id, nome, email, cnpj FROM usuarios WHERE role = 'empresario' ORDER BY id DESC")
        empresas = [{"id": linha[0], "nome": linha[1], "email": linha[2], "cnpj": linha[3]} for linha in cursor.fetchall()]
        
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
    
# ----------------------------------------------------
# 5. ROTA DE CADASTRO DE FORMULÁRIO (Para o Admin)
# ----------------------------------------------------
@app.post("/api/admin/formularios")
def cadastrar_formulario(form: FormularioCadastro):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # 1. Salva o formulário e pega o ID gerado usando RETURNING id
        cursor.execute(
            "INSERT INTO formularios (titulo, descricao, url_google_forms) VALUES (%s, %s, %s) RETURNING id",
            (form.titulo, form.descricao, form.url_google_forms)
        )
        formulario_id = cursor.fetchone()[0]
        
        # 2. Salva os vínculos na tabela muitos-para-muitos
        if form.empresas_ids:
            for empresa_id in form.empresas_ids:
                cursor.execute(
                    "INSERT INTO formulario_empresa (formulario_id, usuario_id) VALUES (%s, %s)",
                    (formulario_id, empresa_id)
                )
                
        conexao.commit()
        cursor.close()
        conexao.close()
        
        return {"status": "Sucesso", "mensagem": "Formulário vinculado com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar o formulário: {str(e)}")

# ----------------------------------------------------
# 6. ROTA PARA LISTAR FORMULÁRIOS (Para Admin e Empresários)
# ----------------------------------------------------
@app.get("/api/formularios")
def listar_formularios(usuario_id: Optional[int] = None):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        if usuario_id:
            # Puxa os dados incluindo se já foi respondido (fe.respondido)
            cursor.execute("""
                SELECT f.id, f.titulo, f.descricao, f.url_google_forms, f.criado_em, fe.respondido 
                FROM formularios f
                JOIN formulario_empresa fe ON f.id = fe.formulario_id
                WHERE fe.usuario_id = %s
                ORDER BY f.id DESC
            """, (usuario_id,))
            formularios = [
                {"id": l[0], "titulo": l[1], "descricao": l[2], "url_google_forms": l[3], "criado_em": l[4], "respondido": l[5]}
                for l in cursor.fetchall()
            ]
        else:
            cursor.execute("SELECT id, titulo, descricao, url_google_forms, criado_em FROM formularios ORDER BY id DESC")
            formularios = [
                {"id": l[0], "titulo": l[1], "descricao": l[2], "url_google_forms": l[3], "criado_em": l[4]}
                for l in cursor.fetchall()
            ]
            
        cursor.close()
        conexao.close()
        return formularios
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ----------------------------------------------------
# 7. ROTA PARA BUSCAR DESTINATÁRIOS DE UM FORMULÁRIO
# ----------------------------------------------------
@app.get("/api/admin/formularios/{formulario_id}/empresas")
def listar_empresas_do_formulario(formulario_id: int):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Pega apenas os IDs das empresas que estão vinculadas a este formulário
        cursor.execute("SELECT usuario_id FROM formulario_empresa WHERE formulario_id = %s", (formulario_id,))
        empresas_ids = [linha[0] for linha in cursor.fetchall()]
        
        cursor.close()
        conexao.close()
        
        return empresas_ids
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao buscar destinatários.")

# ----------------------------------------------------
# 8. ROTA PARA ATUALIZAR DESTINATÁRIOS DE UM FORMULÁRIO
# ----------------------------------------------------
@app.put("/api/admin/formularios/{formulario_id}/empresas")
def atualizar_empresas_do_formulario(formulario_id: int, req: AtualizarDestinatariosRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Primeiro, apagamos todos os vínculos antigos desse formulário
        cursor.execute("DELETE FROM formulario_empresa WHERE formulario_id = %s", (formulario_id,))
        
        # Depois, inserimos a lista nova inteira
        if req.empresas_ids:
            for empresa_id in req.empresas_ids:
                cursor.execute(
                    "INSERT INTO formulario_empresa (formulario_id, usuario_id) VALUES (%s, %s)",
                    (formulario_id, empresa_id)
                )
                
        conexao.commit()
        cursor.close()
        conexao.close()
        
        return {"status": "Sucesso", "mensagem": "Destinatários atualizados com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao atualizar destinatários.")
    
# ----------------------------------------------------
# 9. ROTA PARA MARCAR FORMULÁRIO COMO RESPONDIDO
# ----------------------------------------------------
@app.put("/api/formularios/{formulario_id}/responder")
def marcar_como_respondido(formulario_id: int, req: ResponderFormularioRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        cursor.execute(
            "UPDATE formulario_empresa SET respondido = TRUE WHERE formulario_id = %s AND usuario_id = %s",
            (formulario_id, req.usuario_id)
        )
        conexao.commit()
        
        cursor.close()
        conexao.close()
        return {"status": "Sucesso", "mensagem": "Marcado como concluído!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao atualizar status.")
    
# ----------------------------------------------------
# 10. ROTAS DE EXCLUSÃO (Admin)
# ----------------------------------------------------
@app.delete("/api/admin/empresas/{empresa_id}")
def excluir_empresa(empresa_id: int):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Apaga a empresa (o CASCADE no banco limpa a tabela formulario_empresa)
        cursor.execute("DELETE FROM usuarios WHERE id = %s AND role = 'empresario'", (empresa_id,))
        conexao.commit()
        
        cursor.close()
        conexao.close()
        return {"status": "Sucesso", "mensagem": "Empresa excluída com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao excluir a empresa.")

@app.delete("/api/admin/formularios/{formulario_id}")
def excluir_formulario(formulario_id: int):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Apaga o formulário (o CASCADE também limpa os vínculos automaticamente)
        cursor.execute("DELETE FROM formularios WHERE id = %s", (formulario_id,))
        conexao.commit()
        
        cursor.close()
        conexao.close()
        return {"status": "Sucesso", "mensagem": "Formulário excluído com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao excluir o formulário.")
    

# ----------------------------------------------------
# 11. ROTA DE STATUS DOS FORMULÁRIOS (Admin)
# ----------------------------------------------------
@app.get("/api/admin/formularios/{formulario_id}/status")
def ver_status_formulario(formulario_id: int):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Junta a tabela de vínculos com a de usuários para pegar o nome e o status
        cursor.execute("""
            SELECT u.nome, u.cnpj, fe.respondido 
            FROM formulario_empresa fe
            JOIN usuarios u ON fe.usuario_id = u.id
            WHERE fe.formulario_id = %s
            ORDER BY fe.respondido ASC, u.nome ASC
        """, (formulario_id,))
        
        status_lista = [
            {"nome_empresa": linha[0], "cnpj": linha[1], "respondido": linha[2]}
            for linha in cursor.fetchall()
        ]
        
        cursor.close()
        conexao.close()
        return status_lista
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao buscar status do formulário.")
    
# ----------------------------------------------------
# 12. ROTAS DO ROBÔ DE SCRAPING
# ----------------------------------------------------
@app.post("/api/admin/scraping/config")
def salvar_config_scraping(req: ConfigScrapingRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # 1. Limpa a configuração antiga e salva a nova
        cursor.execute("DELETE FROM scraping_config")
        
        # Transforma a lista do React ['seg', 'ter'] em uma string "seg,ter"
        dias_str = ",".join(req.dias_semana) if req.dias_semana else None
        
        cursor.execute(
            "INSERT INTO scraping_config (repetir_a_cada, unidade_tempo, dias_semana, dia_mes) VALUES (%s, %s, %s, %s)",
            (req.repetir_a_cada, req.unidade_tempo, dias_str, req.dia_mes)
        )
        
        # 2. Atualiza a lista de empresas alvo
        cursor.execute("DELETE FROM scraping_empresas_alvo")
        for emp_id in req.empresas_ids:
            cursor.execute(
                "INSERT INTO scraping_empresas_alvo (empresa_id) VALUES (%s)", 
                (emp_id,)
            )
            
        conexao.commit()
        cursor.close()
        conexao.close()
        
        return {"status": "Sucesso", "mensagem": "Configurações do robô salvas com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/admin/scraping/logs")
def listar_logs_scraping():
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        # Puxa os últimos 50 logs, do mais recente para o mais antigo
        cursor.execute("""
            SELECT id, TO_CHAR(data_execucao, 'DD/MM/YYYY HH24:MI'), status, detalhes 
            FROM scraping_logs 
            ORDER BY id DESC LIMIT 50
        """)
        
        logs = [
            {"id": l[0], "data": l[1], "status": l[2], "detalhes": l[3]}
            for l in cursor.fetchall()
        ]
        
        cursor.close()
        conexao.close()
        return logs
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao buscar logs.")