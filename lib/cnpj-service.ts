export type CNPJData = {
  nome: string;
  fantasia: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email: string;
  telefone: string;
  atividade_principal: { code: string; text: string }[];
}

export async function lookupCNPJ(cnpj: string): Promise<CNPJData | null> {
  // Em um cenário real, usaríamos uma API como BrasilAPI ou ReceitaWS
  // Ex: return fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj.replace(/\D/g, '')}`).then(res => res.json())

  const cleanCnpj = cnpj.replace(/\D/g, '');
  
  // Mock de dados para demonstração
  if (cleanCnpj.length === 14) {
    return {
      nome: "EMPRESA DE EXEMPLO LTDA",
      fantasia: "EXEMPLO CONTABILIDADE",
      logradouro: "AVENIDA PAULISTA",
      numero: "1000",
      bairro: "BELA VISTA",
      municipio: "SÃO PAULO",
      uf: "SP",
      cep: "01310-100",
      email: "contato@exemplo.com.br",
      telefone: "(11) 99999-8888",
      atividade_principal: [
        { code: "69.20-6-01", text: "Atividades de contabilidade" }
      ]
    };
  }
  
  return null;
}
