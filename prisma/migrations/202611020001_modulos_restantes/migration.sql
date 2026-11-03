-- Atualização de tabela
ALTER TABLE `aposta` ADD COLUMN `odd_solicitada` DECIMAL(12, 4) NULL,
    ADD COLUMN `promocao_id` CHAR(36) NULL,
    ADD COLUMN `promocao_snapshot` JSON NULL;

-- Atualização de tabela
ALTER TABLE `jogo` ADD COLUMN `gerenciado` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `local_id` INTEGER NOT NULL AUTO_INCREMENT, ADD UNIQUE INDEX `jogo_local_id_key` (`local_id`),
    ADD COLUMN `placar_mandante` INTEGER NULL,
    ADD COLUMN `placar_visitante` INTEGER NULL,
    ADD COLUMN `removido_em` DATETIME(3) NULL,
    ADD COLUMN `versao` INTEGER NOT NULL DEFAULT 0;

-- Atualização de tabela
ALTER TABLE `movimentacao` MODIFY `tipo` ENUM('CREDITO_INICIAL', 'RECARGA_SIMULADA', 'APOSTA', 'PREMIO', 'ESTORNO', 'BONUS', 'AJUSTE_ADMIN', 'SAQUE_SIMULADO', 'ESTORNO_SAQUE') NOT NULL;

-- Atualização de tabela
ALTER TABLE `promocao` ADD COLUMN `removida_em` DATETIME(3) NULL,
    ADD COLUMN `versao` INTEGER NOT NULL DEFAULT 0;

-- Atualização de tabela
ALTER TABLE `usuario` ADD COLUMN `excluido_em` DATETIME(3) NULL;

-- Criação da tabela de saques
CREATE TABLE `saque` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `carteira_id` CHAR(36) NOT NULL,
    `valor` DECIMAL(18, 2) NOT NULL,
    `metodo` VARCHAR(60) NOT NULL,
    `status` ENUM('PENDENTE', 'APROVADO', 'RECUSADO') NOT NULL DEFAULT 'PENDENTE',
    `idempotency_key` CHAR(36) NOT NULL,
    `admin_id` CHAR(36) NULL,
    `motivo` VARCHAR(500) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidido_em` DATETIME(3) NULL,

    UNIQUE INDEX `saque_idempotency_key_key`(`idempotency_key`),
    INDEX `saque_usuario_id_criado_em_idx`(`usuario_id`, `criado_em`),
    INDEX `saque_status_criado_em_idx`(`status`, `criado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
