import { api } from "./client"

export type Frequencia = "diario" | "semanal" | "mensal" | "desligado"
export type Destinatario = { email: string; banco: boolean }

export type BackupConfig = {
  destinatarios: Destinatario[]
  freq_banco: Frequencia
  freq_planilha: Frequencia
  tem_senha: boolean
  configurado: boolean
  ultimo_envio: { quando: string; ok: boolean; texto: string } | null
  envio_pedido_em: string | null
}

export type BackupUpdate = Pick<BackupConfig, "destinatarios" | "freq_banco" | "freq_planilha"> & {
  senha_login: string
  senha_arquivos: string
}

export const backupApi = {
  get: () => api.get<BackupConfig>("/backup"),
  update: (data: BackupUpdate) => api.put<BackupConfig>("/backup", data),
  enviar: () => api.post<BackupConfig>("/backup/enviar"),
}
