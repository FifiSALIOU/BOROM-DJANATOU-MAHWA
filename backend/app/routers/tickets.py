from typing import List, Optional
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user, require_role

router = APIRouter()


@router.post("/", response_model=schemas.TicketRead)
def create_ticket(
    ticket_in: schemas.TicketCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role("Utilisateur")),
):
    """Créer un nouveau ticket"""
    # Générer le numéro de ticket automatiquement
    # Récupérer le dernier numéro de ticket
    last_ticket = db.query(models.Ticket).order_by(models.Ticket.number.desc()).first()
    next_number = 1
    if last_ticket and last_ticket.number:
        next_number = last_ticket.number + 1
    
    ticket = models.Ticket(
        number=next_number,  # Assigner le numéro généré
        title=ticket_in.title,
        description=ticket_in.description,
        type=ticket_in.type,
        priority=ticket_in.priority,
        creator_id=current_user.id,
        user_agency=current_user.agency,  # Enregistrer l'agence de l'utilisateur créateur
        status=models.TicketStatus.EN_ATTENTE_ANALYSE,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    # Créer une notification pour les Secrétaires/Adjoints DSI
    secretary_role = db.query(models.Role).filter(models.Role.name.in_(["Secrétaire DSI", "Adjoint DSI"])).all()
    if secretary_role:
        for role in secretary_role:
            secretaries = db.query(models.User).filter(
                models.User.role_id == role.id,
                models.User.status == "actif"
            ).all()
            for secretary in secretaries:
                notification = models.Notification(
                    user_id=secretary.id,
                    type=models.NotificationType.NOUVEAU_TICKET,
                    ticket_id=ticket.id,
                    message=f"Nouveau ticket #{ticket.number} créé: {ticket.title}",
                    read=False
                )
                db.add(notification)
        db.commit()
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    
    return ticket


@router.get("/me", response_model=List[schemas.TicketRead])
def list_my_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste des tickets créés par l'utilisateur connecté"""
    tickets = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.creator_id == current_user.id)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    return tickets


@router.get("/", response_model=List[schemas.TicketRead])
def list_all_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("Secrétaire DSI", "Adjoint DSI", "DSI", "Admin")
    ),
):
    """Liste de tous les tickets (pour secrétaire/adjoint/DSI/admin)"""
    tickets = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    return tickets


@router.get("/assigned", response_model=List[schemas.TicketRead])
def list_assigned_tickets(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Liste des tickets assignés au technicien connecté"""
    tickets = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.technician_id == current_user.id)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    return tickets


@router.get("/{ticket_id}", response_model=schemas.TicketRead)
def get_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Récupérer un ticket par son ID"""
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket_id)
        .first()
    )
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier les permissions : créateur, technicien assigné, ou agent/DSI
    is_creator = ticket.creator_id == current_user.id
    is_assigned_tech = ticket.technician_id == current_user.id
    is_agent = current_user.role and current_user.role.name in ["Secrétaire DSI", "Adjoint DSI", "DSI", "Admin"]
    
    if not (is_creator or is_assigned_tech or is_agent):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Access denied"
        )
    
    return ticket


@router.put("/{ticket_id}/assign", response_model=schemas.TicketRead)
def assign_ticket(
    ticket_id: UUID,
    assign_data: schemas.TicketAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("Secrétaire DSI", "Adjoint DSI", "DSI", "Admin")
    ),
):
    """Assigner un ticket à un technicien"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que le technicien existe
    technician = db.query(models.User).filter(models.User.id == assign_data.technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found"
        )
    
    # Enregistrer l'ancien statut pour l'historique
    old_status = ticket.status
    
    # Assigner le ticket
    ticket.technician_id = assign_data.technician_id
    ticket.secretary_id = current_user.id
    ticket.status = models.TicketStatus.ASSIGNE_TECHNICIEN
    ticket.assigned_at = datetime.utcnow()
    
    # Créer une entrée d'historique avec notes/instructions
    history_reason = assign_data.reason or ""
    if assign_data.notes:
        history_reason += f" | Instructions: {assign_data.notes}"
    
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=history_reason,
    )
    db.add(history)
    
    # Créer une notification pour le technicien
    notification = models.Notification(
        user_id=assign_data.technician_id,
        type=models.NotificationType.ASSIGNATION,
        ticket_id=ticket.id,
        message=f"Un nouveau ticket #{ticket.number} vous a été assigné: {ticket.title}",
        read=False
    )
    db.add(notification)
    
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    
    return ticket


@router.put("/{ticket_id}/reassign", response_model=schemas.TicketRead)
def reassign_ticket(
    ticket_id: UUID,
    assign_data: schemas.TicketAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("Secrétaire DSI", "Adjoint DSI", "DSI", "Admin")
    ),
):
    """Réassigner un ticket à un autre technicien"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que le ticket est déjà assigné
    if not ticket.technician_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is not assigned yet. Use /assign instead."
        )
    
    # Vérifier que le technicien existe
    technician = db.query(models.User).filter(models.User.id == assign_data.technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found"
        )
    
    # Vérifier qu'on ne réassigne pas au même technicien
    if ticket.technician_id == assign_data.technician_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is already assigned to this technician"
        )
    
    old_status = ticket.status
    old_technician_id = ticket.technician_id
    
    # Réassigner le ticket
    ticket.technician_id = assign_data.technician_id
    ticket.secretary_id = current_user.id
    ticket.assigned_at = datetime.utcnow()
    # Le statut reste le même ou passe à ASSIGNE_TECHNICIEN si nécessaire
    if ticket.status == models.TicketStatus.EN_ATTENTE_ANALYSE:
        ticket.status = models.TicketStatus.ASSIGNE_TECHNICIEN
    
    # Créer une entrée d'historique
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=f"Réassigné depuis {old_technician_id} vers {assign_data.technician_id}. {assign_data.reason or ''}",
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    
    return ticket


@router.put("/{ticket_id}/escalate", response_model=schemas.TicketRead)
def escalate_ticket(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("Adjoint DSI", "DSI", "Admin")
    ),
):
    """Escalader un ticket (augmenter la priorité)"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    old_priority = ticket.priority
    old_status = ticket.status
    
    # Augmenter la priorité
    if ticket.priority == models.TicketPriority.FAIBLE:
        ticket.priority = models.TicketPriority.MOYENNE
    elif ticket.priority == models.TicketPriority.MOYENNE:
        ticket.priority = models.TicketPriority.HAUTE
    elif ticket.priority == models.TicketPriority.HAUTE:
        ticket.priority = models.TicketPriority.CRITIQUE
    # Si déjà critique, on ne peut plus escalader
    
    if ticket.priority == old_priority:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket priority is already at maximum (Critique)"
        )
    
    # Créer une entrée d'historique
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=f"Ticket escaladé : priorité passée de {old_priority} à {ticket.priority}",
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    
    return ticket


@router.put("/{ticket_id}/status", response_model=schemas.TicketRead)
def update_ticket_status(
    ticket_id: UUID,
    status_update: schemas.TicketUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Mettre à jour le statut d'un ticket"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier les permissions selon le statut
    if status_update.status == models.TicketStatus.RESOLU:
        # Seul le technicien assigné peut marquer comme résolu
        if ticket.technician_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only assigned technician can mark as resolved"
            )
        ticket.resolved_at = datetime.utcnow()
        
        # Créer une notification pour l'utilisateur créateur
        notification = models.Notification(
            user_id=ticket.creator_id,
            type=models.NotificationType.RESOLUTION,
            ticket_id=ticket.id,
            message=f"Votre ticket #{ticket.number} a été résolu. Veuillez valider la résolution.",
            read=False
        )
        db.add(notification)
    elif status_update.status == models.TicketStatus.CLOTURE:
        # Seuls secrétaire/adjoint/DSI/Admin peuvent clôturer
        if not current_user.role or current_user.role.name not in ["Secrétaire DSI", "Adjoint DSI", "DSI", "Admin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only agents can close tickets"
            )
        ticket.closed_at = datetime.utcnow()
    elif status_update.status == models.TicketStatus.EN_COURS:
        # Le technicien assigné peut mettre en cours
        if ticket.technician_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only assigned technician can set in progress"
            )
    
    old_status = ticket.status
    ticket.status = status_update.status
    
    # Créer une entrée d'historique avec résumé si résolu
    history_reason = None
    if status_update.status == models.TicketStatus.RESOLU and status_update.resolution_summary:
        history_reason = f"Résumé de la résolution: {status_update.resolution_summary}"
    
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=status_update.status,
        user_id=current_user.id,
        reason=history_reason,
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    
    return ticket


@router.post("/{ticket_id}/comments", response_model=schemas.CommentRead)
def add_comment(
    ticket_id: UUID,
    comment_in: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Ajouter un commentaire à un ticket"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    comment = models.Comment(
        ticket_id=ticket_id,
        user_id=current_user.id,
        content=comment_in.content,
        type=comment_in.type,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return comment


@router.get("/{ticket_id}/comments", response_model=List[schemas.CommentRead])
def get_ticket_comments(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Récupérer tous les commentaires d'un ticket"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    comments = (
        db.query(models.Comment)
        .filter(models.Comment.ticket_id == ticket_id)
        .order_by(models.Comment.created_at.asc())
        .all()
    )
    return comments


@router.put("/{ticket_id}/validate", response_model=schemas.TicketRead)
def validate_ticket_resolution(
    ticket_id: UUID,
    validation: schemas.TicketValidation,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Valider ou rejeter la résolution d'un ticket (par le créateur du ticket)"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que c'est le créateur du ticket
    if ticket.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ticket creator can validate resolution"
        )
    
    # Vérifier que le ticket est en statut "résolu"
    if ticket.status != models.TicketStatus.RESOLU:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket must be resolved before validation"
        )
    
    old_status = ticket.status
    
    if validation.validated:
        # Utilisateur valide → Clôturer
        ticket.status = models.TicketStatus.CLOTURE
        ticket.closed_at = datetime.utcnow()
    else:
        # Utilisateur rejette → Rejeter
        ticket.status = models.TicketStatus.REJETE
        
        # Notifier le technicien assigné
        if ticket.technician_id:
            notification = models.Notification(
                user_id=ticket.technician_id,
                type=models.NotificationType.RESOLUTION,
                ticket_id=ticket.id,
                message=f"L'utilisateur a rejeté la résolution du ticket #{ticket.number}. Veuillez continuer l'investigation.",
                read=False
            )
            db.add(notification)
    
    # Créer une entrée d'historique
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=f"Validation utilisateur: {'Validé' if validation.validated else 'Rejeté'}"
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return ticket


@router.put("/{ticket_id}/accept-assignment", response_model=schemas.TicketRead)
def accept_assignment(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Accepter une assignation de ticket"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que le ticket est assigné au technicien connecté
    if ticket.technician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This ticket is not assigned to you"
        )
    
    if ticket.status != models.TicketStatus.ASSIGNE_TECHNICIEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is not in assigned status"
        )
    
    # Le technicien accepte, le statut reste "assigné" (il peut ensuite "prendre en charge")
    # On crée une entrée d'historique pour tracer l'acceptation
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=ticket.status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason="Assignation acceptée par le technicien"
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return ticket


@router.put("/{ticket_id}/reject-assignment", response_model=schemas.TicketRead)
def reject_assignment(
    ticket_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    reason: Optional[str] = Query(None),
):
    """Refuser une assignation de ticket (demande de réassignation)"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que le ticket est assigné au technicien connecté
    if ticket.technician_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This ticket is not assigned to you"
        )
    
    if ticket.status != models.TicketStatus.ASSIGNE_TECHNICIEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ticket is not in assigned status"
        )
    
    # Remettre le ticket en attente d'analyse pour réassignation
    old_status = ticket.status
    ticket.technician_id = None
    ticket.status = models.TicketStatus.EN_ATTENTE_ANALYSE
    
    # Créer une entrée d'historique
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=f"Assignation refusée par le technicien. Raison: {reason or 'N/A'}"
    )
    db.add(history)
    
    # Notifier le secrétaire/adjoint
    if ticket.secretary_id:
        notification = models.Notification(
            user_id=ticket.secretary_id,
            type=models.NotificationType.ASSIGNATION,
            ticket_id=ticket.id,
            message=f"Le technicien a refusé l'assignation du ticket #{ticket.number}. Réassignation nécessaire.",
            read=False
        )
        db.add(notification)
    
    db.commit()
    db.refresh(ticket)
    
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return ticket


@router.put("/{ticket_id}/feedback", response_model=schemas.TicketRead)
def submit_ticket_feedback(
    ticket_id: UUID,
    feedback: schemas.TicketFeedback,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Soumettre le feedback/satisfaction pour un ticket clôturé"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que c'est le créateur du ticket
    if ticket.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only ticket creator can submit feedback"
        )
    
    # Vérifier que le ticket est clôturé
    if ticket.status != models.TicketStatus.CLOTURE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Feedback can only be submitted for closed tickets"
        )
    
    # Vérifier le score (1-5)
    if feedback.score < 1 or feedback.score > 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Score must be between 1 and 5"
        )
    
    # Enregistrer le feedback
    ticket.feedback_score = feedback.score
    ticket.feedback_comment = feedback.comment
    
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return ticket


@router.put("/{ticket_id}/reopen", response_model=schemas.TicketRead)
def reopen_ticket(
    ticket_id: UUID,
    assign_data: schemas.TicketAssign,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_role("Secrétaire DSI", "Adjoint DSI", "DSI", "Admin")
    ),
):
    """Réouvrir un ticket rejeté et le réassigner à un technicien"""
    ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found"
        )
    
    # Vérifier que le ticket est rejeté
    if ticket.status != models.TicketStatus.REJETE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only rejected tickets can be reopened"
        )
    
    # Vérifier que le technicien existe
    technician = db.query(models.User).filter(models.User.id == assign_data.technician_id).first()
    if not technician:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Technician not found"
        )
    
    old_status = ticket.status
    
    # Réassigner et remettre en statut "assigné"
    ticket.technician_id = assign_data.technician_id
    ticket.secretary_id = current_user.id
    ticket.status = models.TicketStatus.ASSIGNE_TECHNICIEN
    ticket.assigned_at = datetime.utcnow()
    
    # Créer une entrée d'historique
    history = models.TicketHistory(
        ticket_id=ticket.id,
        old_status=old_status,
        new_status=ticket.status,
        user_id=current_user.id,
        reason=f"Ticket réouvert et réassigné. Raison: {assign_data.reason or 'N/A'}"
    )
    db.add(history)
    db.commit()
    db.refresh(ticket)
    
    # Charger les relations pour la réponse
    ticket = (
        db.query(models.Ticket)
        .options(
            joinedload(models.Ticket.creator),
            joinedload(models.Ticket.technician)
        )
        .filter(models.Ticket.id == ticket.id)
        .first()
    )
    return ticket
