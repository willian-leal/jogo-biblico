using JogoBiblicoBackend.Models;

namespace JogoBiblicoBackend.Services;

public class SalaEquipesService
{
    private readonly Dictionary<string, SalaEquipes> _salas = [];
    private readonly Dictionary<string, string> _conexaoParaSala = [];
    private readonly object _lock = new();

    public string CriarSala(SalaEquipes sala)
    {
        lock (_lock)
        {
            string codigo;
            do { codigo = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant(); }
            while (_salas.ContainsKey(codigo));

            sala.CodigoSala = codigo;
            _salas[codigo] = sala;
            foreach (var jogador in sala.Jogadores)
                _conexaoParaSala[jogador.ConnectionId] = codigo;
            return codigo;
        }
    }

    public SalaEquipes? ObterSala(string codigo)
    {
        lock (_lock) return _salas.GetValueOrDefault(codigo);
    }

    public bool RegistrarConexao(string connectionId, string codigoSala)
    {
        lock (_lock)
        {
            if (!_salas.ContainsKey(codigoSala)) return false;
            _conexaoParaSala[connectionId] = codigoSala;
            return true;
        }
    }

    public SalaEquipes? SalaDoJogador(string connectionId)
    {
        lock (_lock)
        {
            return _conexaoParaSala.TryGetValue(connectionId, out var codigo)
                ? _salas.GetValueOrDefault(codigo)
                : null;
        }
    }

    public void RemoverConexao(string connectionId)
    {
        lock (_lock) _conexaoParaSala.Remove(connectionId);
    }

    public void RemoverSala(string codigo)
    {
        lock (_lock) _salas.Remove(codigo);
    }
}
