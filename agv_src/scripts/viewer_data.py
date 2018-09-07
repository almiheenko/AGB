class ViewerData:
    def __init__(self,  graphs, hanging_nodes, connected_nodes, modified_dict_edges, parts_info,
                 enters=None, exits=None):
        self.g = graphs
        self.hanging_nodes = hanging_nodes
        self.connected_nodes = connected_nodes
        self.modified_dict_edges = modified_dict_edges
        self.parts_info = parts_info
        self.enters = enters
        self.exits = exits

