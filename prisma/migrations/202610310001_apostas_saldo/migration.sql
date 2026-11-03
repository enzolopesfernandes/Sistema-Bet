-- Preserva os jogos e as movimentações existentes.
ALTER TABLE `jogo` ADD COLUMN `api_football_id` INTEGER NULL;
CREATE UNIQUE INDEX `uq_jogo_api_football` ON `jogo` (`api_football_id`);
ALTER TABLE `movimentacao` MODIFY `tipo` ENUM('CREDITO_INICIAL', 'RECARGA_SIMULADA', 'APOSTA', 'PREMIO', 'ESTORNO', 'BONUS', 'AJUSTE_ADMIN') NOT NULL;
