import { Request, Response } from "express";
import { 
    getAllRooms, 
    getRoomById, 
    handleCreateRoom, 
    handleDeleteRoom, 
    updateRoomById 
} from "services/admin/room.service";
import { RoomStatus } from "@prisma/client";

const getRoomListPage = async (req: Request, res: Response) => {
    try {
        const rooms = await getAllRooms();
        return res.render("admin/room/show.ejs", {
            rooms: rooms
        });
    } catch (error) {
        console.error("Error getting rooms:", error);
        return res.status(500).send("Internal Server Error");
    }
}

const getCreateRoomPage = async (req: Request, res: Response) => {
    return res.render("admin/room/create.ejs", {
        roomStatuses: Object.values(RoomStatus)
    });
}

const postCreateRoom = async (req: Request, res: Response) => {
    try {
        const { name, type, price, capacity, description, status } = req.body;
        const file = req.file;
        const image = file?.filename ?? null;

        await handleCreateRoom(name, type, price, capacity, description, image, status);
        return res.redirect("/admin/room");
    } catch (error) {
        console.error("Error creating room:", error);
        return res.status(500).send("Error creating room");
    }
}

const getViewRoom = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const room = await getRoomById(id);

        if (!room) {
            return res.status(404).send("Room not found");
        }

        return res.render("admin/room/detail.ejs", {
            room: room,
            roomStatuses: Object.values(RoomStatus)
        });
    } catch (error) {
        console.error("Error getting room:", error);
        return res.status(500).send("Internal Server Error");
    }
}

const postUpdateRoom = async (req: Request, res: Response) => {
    try {
        const { id, name, type, price, capacity, description, status } = req.body;
        const file = req.file;
        const image = file?.filename ?? undefined;

        await updateRoomById(id, name, type, price, capacity, description, image, status);
        return res.redirect("/admin/room");
    } catch (error) {
        console.error("Error updating room:", error);
        return res.status(500).send("Error updating room");
    }
}

const postDeleteRoom = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await handleDeleteRoom(id);
        return res.redirect("/admin/room");
    } catch (error) {
        console.error("Error deleting room:", error);
        return res.status(500).send("Error deleting room");
    }
}

export {
    getRoomListPage,
    getCreateRoomPage,
    postCreateRoom,
    getViewRoom,
    postUpdateRoom,
    postDeleteRoom
}