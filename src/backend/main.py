import string
import secrets
import subprocess
import json
import os
from datetime import date, timedelta
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from passlib.context import CryptContext
import psycopg2
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List

app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_CONFIG = {
    "dbname":   os.getenv("DB_NAME",     "olimpia_turismo"),
    "user":     os.getenv("DB_USER",     "postgres"),
    "password": os.getenv("DB_PASSWORD", "chimbica"),
    "host":     os.getenv("DB_HOST",     "localhost"),
    "port":     os.getenv("DB_PORT",     "5432"),
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
    cnpj: Optional[str] = None
    url_booking: Optional[str] = None

class EmpresaUpdate(BaseModel):
    nome: str
    email: str
    cnpj: Optional[str] = None
    url_booking: Optional[str] = None

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

class ExecutarScrapingRequest(BaseModel):
    # Se vazio, usa as empresas configuradas em scraping_empresas_alvo
    empresas_ids: List[int] = []
    checkin: Optional[str] = None
    checkout: Optional[str] = None
    adultos: int = 2

# Caminho do binário Go (compilado com `go build -o scraper .` em src/scraper/).
# Em Docker, vem de /usr/local/bin/scraper via env SCRAPER_BIN.
# Se o binário não existir, cai pra `go run .` no diretório do scraper.
SCRAPER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scraper"))
SCRAPER_BIN = os.getenv("SCRAPER_BIN", os.path.join(SCRAPER_DIR, "scraper"))

# Integração Google Sheets — opcional. Se GOOGLE_SHEET_URL estiver vazia, o
# envio é silenciosamente pulado (a execução do scraping segue normal).
GOOGLE_SHEET_URL = os.getenv("GOOGLE_SHEET_URL", "").strip()
GOOGLE_CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "").strip()

# Ordem fixa de colunas escritas na planilha. A linha 1 da planilha deve
# conter o cabeçalho correspondente (criado pelo usuário); append_rows()
# começa a escrever a partir da primeira linha vazia, preservando o header.
PLANILHA_COLUNAS = [
    "Data execução", "ID empresa", "Nome empresa", "URL hotel",
    "Check-in", "Check-out", "Adultos", "Moeda",
    "Preço diária", "Preço total", "Preço bruto",
    "Observação", "Sucesso", "Erro",
]

def _enviar_planilha(linhas: List[list]) -> dict:
    """Anexa linhas à 1ª aba da planilha em GOOGLE_SHEET_URL, preservando o cabeçalho.

    Devolve {"enviado": bool, "linhas": int, "erro": Optional[str]}.
    Pula silenciosamente quando GOOGLE_SHEET_URL não está configurada.
    """
    if not GOOGLE_SHEET_URL:
        return {"enviado": False, "linhas": 0, "erro": None}
    if not linhas:
        return {"enviado": False, "linhas": 0, "erro": None}
    if not GOOGLE_CREDENTIALS_PATH or not os.path.isfile(GOOGLE_CREDENTIALS_PATH):
        return {
            "enviado": False, "linhas": 0,
            "erro": "GOOGLE_CREDENTIALS_PATH não aponta para um arquivo de service account válido",
        }
    try:
        import gspread
        gc = gspread.service_account(filename=GOOGLE_CREDENTIALS_PATH)
        ws = gc.open_by_url(GOOGLE_SHEET_URL).sheet1
        # append_rows posiciona a partir da 1ª linha vazia → header (linha 1) intocado.
        ws.append_rows(linhas, value_input_option="USER_ENTERED")
        return {"enviado": True, "linhas": len(linhas), "erro": None}
    except Exception as e:
        return {"enviado": False, "linhas": 0, "erro": f"{type(e).__name__}: {e}"}

def _rodar_scraper(url: str, checkin: str, checkout: str, adultos: int, timeout_seg: int = 120):
    """Invoca o scraper Go pra uma URL do Booking e devolve (dados_json_ou_None, stderr)."""
    if os.path.exists(SCRAPER_BIN) and os.access(SCRAPER_BIN, os.X_OK):
        cmd = [SCRAPER_BIN]
        # Binário não depende de arquivos relativos — não force cwd em diretório
        # que pode não existir (caso típico em container).
        cwd = SCRAPER_DIR if os.path.isdir(SCRAPER_DIR) else None
    else:
        cmd = ["go", "run", "."]
        cwd = SCRAPER_DIR

    cmd += [
        "-url", url,
        "-checkin", checkin,
        "-checkout", checkout,
        "-adultos", str(adultos),
        "-timeout", str(max(30, timeout_seg - 10)),
    ]

    try:
        proc = subprocess.run(
            cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout_seg
        )
    except subprocess.TimeoutExpired:
        return None, f"timeout de {timeout_seg}s estourado"
    except FileNotFoundError as e:
        return None, f"binário não encontrado: {e}"

    # O scraper imprime JSON no stdout mesmo quando sai com código 1
    # (ex.: hotel indisponível nas datas). Tentamos parsear primeiro.
    if proc.stdout.strip():
        try:
            return json.loads(proc.stdout), proc.stderr.strip()
        except json.JSONDecodeError:
            pass
    return None, (proc.stderr.strip() or f"sem saída (exit {proc.returncode})")

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
            "INSERT INTO usuarios (nome, email, senha, role, cnpj, url_booking) VALUES (%s, %s, %s, 'empresario', %s, %s)",
            (empresa.nome, empresa.email, senha_criptografada, empresa.cnpj, empresa.url_booking)
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
        cursor.execute("SELECT id, nome, email, cnpj, url_booking FROM usuarios WHERE role = 'empresario' ORDER BY id DESC")
        empresas = [
            {"id": l[0], "nome": l[1], "email": l[2], "cnpj": l[3], "url_booking": l[4]} 
            for l in cursor.fetchall()
        ]
        
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

# Executa o scraper agora pra todas as empresas alvo (ou pra uma lista
# explícita no body). Não grava nada em banco — devolve o JSON pro frontend
# imprimir no console. Próximo passo: enviar pra Google Sheets.
@app.post("/api/admin/scraping/executar")
def executar_scraping(req: ExecutarScrapingRequest):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()

        if req.empresas_ids:
            cursor.execute(
                "SELECT id, nome, url_booking FROM usuarios "
                "WHERE id = ANY(%s) AND role = 'empresario'",
                (req.empresas_ids,),
            )
        else:
            cursor.execute(
                "SELECT u.id, u.nome, u.url_booking FROM usuarios u "
                "JOIN scraping_empresas_alvo a ON a.empresa_id = u.id "
                "WHERE u.role = 'empresario'"
            )
        empresas = cursor.fetchall()
        cursor.close()
        conexao.close()
    except psycopg2.Error as e:
        raise HTTPException(status_code=500, detail=f"Erro no banco: {str(e)}")

    if not empresas:
        raise HTTPException(
            status_code=400,
            detail="Nenhuma empresa para raspar. Selecione empresas na configuração do robô ou envie empresas_ids.",
        )

    # Datas padrão: amanhã / depois de amanhã
    hoje = date.today()
    ci = req.checkin or (hoje + timedelta(days=1)).isoformat()
    co = req.checkout or (hoje + timedelta(days=2)).isoformat()

    resultados = []
    for emp_id, nome, url_booking in empresas:
        if not url_booking:
            resultados.append({
                "empresa_id": emp_id,
                "empresa_nome": nome,
                "sucesso": False,
                "erro": "empresa não tem url_booking cadastrada",
                "dados": None,
            })
            continue

        dados, erro = _rodar_scraper(url_booking, ci, co, req.adultos)
        # Sucesso = veio um preço (diária ou total). A observação pode existir
        # mesmo em sucesso (ex.: data ajustada porque a original tava lotada).
        tem_preco = bool(dados and (dados.get("preco_diaria") or dados.get("preco_total")))
        resultados.append({
            "empresa_id": emp_id,
            "empresa_nome": nome,
            "sucesso": tem_preco,
            "erro": erro or None,
            "dados": dados,
        })

    # Monta as linhas na ordem definida por PLANILHA_COLUNAS e envia em batch.
    hoje_iso = date.today().isoformat()
    linhas_planilha = []
    for r in resultados:
        d = r.get("dados") or {}
        linhas_planilha.append([
            hoje_iso,
            r["empresa_id"],
            r["empresa_nome"],
            d.get("url_hotel", ""),
            d.get("checkin", ci),
            d.get("checkout", co),
            d.get("adultos", req.adultos),
            d.get("moeda", ""),
            d.get("preco_diaria", ""),
            d.get("preco_total", ""),
            d.get("preco_bruto", ""),
            d.get("observacao", ""),
            "sim" if r["sucesso"] else "não",
            r.get("erro") or "",
        ])
    envio_planilha = _enviar_planilha(linhas_planilha)

    return {
        "checkin": ci,
        "checkout": co,
        "adultos": req.adultos,
        "total": len(resultados),
        "resultados": resultados,
        "planilha": envio_planilha,
    }

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
    
# ----------------------------------------------------
# 13. ROTA PARA EDITAR DADOS DA EMPRESA
# ----------------------------------------------------
@app.put("/api/admin/empresas/{empresa_id}")
def editar_empresa(empresa_id: int, emp: EmpresaUpdate):
    try:
        conexao = psycopg2.connect(**DB_CONFIG)
        cursor = conexao.cursor()
        
        cursor.execute("""
            UPDATE usuarios 
            SET nome = %s, email = %s, cnpj = %s, url_booking = %s 
            WHERE id = %s AND role = 'empresario'
        """, (emp.nome, emp.email, emp.cnpj, emp.url_booking, empresa_id))
        
        conexao.commit()
        cursor.close()
        conexao.close()
        
        return {"status": "Sucesso", "mensagem": "Dados atualizados com sucesso!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao atualizar a empresa.")