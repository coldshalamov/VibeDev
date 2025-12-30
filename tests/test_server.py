def test_server_module_exports_mcp_and_main():
    from vibedev_mcp import server

    assert getattr(server, "mcp").name == "vibedev_mcp"
    assert callable(getattr(server, "main"))
