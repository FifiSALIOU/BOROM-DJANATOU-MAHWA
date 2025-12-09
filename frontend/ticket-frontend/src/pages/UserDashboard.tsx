import { useEffect, useState, useRef } from "react";
import type { FormEvent } from "react";

interface UserDashboardProps {
  token: string;
}

interface Ticket {
  id: string;
  number: number;
  title: string;
  status: string;
  priority: string;
  feedback_score?: number | null;
  technician?: {
    full_name: string;
    profile_photo_url?: string | null;
  } | null;
  created_at: string;
  assigned_at?: string | null;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string | null;
}

function UserDashboard({ token: tokenProp }: UserDashboardProps) {
  // Récupérer le token depuis localStorage si le prop est vide
  const [actualToken, setActualToken] = useState<string>(() => {
    if (tokenProp && tokenProp.trim() !== "") {
      return tokenProp;
    }
    const storedToken = localStorage.getItem("token");
    return storedToken || "";
  });
  
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("moyenne");
  const [type, setType] = useState("materiel");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationTicket, setValidationTicket] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [showRejectionForm, setShowRejectionForm] = useState<boolean>(false);
  const [feedbackTicket, setFeedbackTicket] = useState<string | null>(null);
  const [feedbackScore, setFeedbackScore] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  
  // Mettre à jour le token si le prop change
  useEffect(() => {
    if (tokenProp && tokenProp.trim() !== "") {
      setActualToken(tokenProp);
    } else {
      const storedToken = localStorage.getItem("token");
      if (storedToken) {
        setActualToken(storedToken);
      } else {
        console.error("Aucun token trouvé - redirection vers la page de connexion");
        window.location.href = "/";
      }
    }
  }, [tokenProp]);

  async function loadTickets() {
    if (!actualToken || actualToken.trim() === "") {
      console.warn("Pas de token pour charger les tickets");
      return;
    }
    
    try {
      const res = await fetch("http://localhost:8000/tickets/me", {
        headers: {
          Authorization: `Bearer ${actualToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      } else if (res.status === 401) {
        // Token invalide, rediriger vers la page de connexion
        localStorage.removeItem("token");
        localStorage.removeItem("userRole");
        window.location.href = "/";
      }
    } catch (err) {
      console.error("Erreur lors du chargement des tickets:", err);
    }
  }

  async function loadNotifications() {
    if (!actualToken || actualToken.trim() === "") {
      return;
    }
    
    try {
      const res = await fetch("http://localhost:8000/notifications/", {
        headers: {
          Authorization: `Bearer ${actualToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Erreur lors du chargement des notifications:", err);
    }
  }

  async function loadUnreadCount() {
    if (!actualToken || actualToken.trim() === "") {
      return;
    }
    
    try {
      const res = await fetch("http://localhost:8000/notifications/unread/count", {
        headers: {
          Authorization: `Bearer ${actualToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unread_count || 0);
      }
    } catch (err) {
      console.error("Erreur lors du chargement du nombre de notifications non lues:", err);
    }
  }

  async function markNotificationAsRead(notificationId: string) {
    if (!actualToken || actualToken.trim() === "") {
      return;
    }
    
    try {
      const res = await fetch(`http://localhost:8000/notifications/${notificationId}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${actualToken}`,
        },
      });
      if (res.ok) {
        // Recharger les notifications et le compteur
        await loadNotifications();
        await loadUnreadCount();
      }
    } catch (err) {
      console.error("Erreur lors du marquage de la notification comme lue:", err);
    }
  }

  function handleLogout() {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("userRole");
    } catch (e) {
      console.error("Erreur lors de la suppression des informations de session:", e);
    }
    setActualToken("");
    window.location.href = "/";
  }

  useEffect(() => {
    if (actualToken) {
      void loadTickets();
      void loadNotifications();
      void loadUnreadCount();
      // Charger les informations de l'utilisateur
      async function loadUserInfo() {
        try {
          const res = await fetch("http://localhost:8000/auth/me", {
            headers: {
              Authorization: `Bearer ${actualToken}`,
            },
          });
          if (res.ok) {
            const data = await res.json();
            setUserInfo({ full_name: data.full_name });
          }
        } catch (err) {
          console.error("Erreur lors du chargement des infos utilisateur:", err);
        }
      }
      void loadUserInfo();
      
      // Recharger les notifications toutes les 30 secondes
      const interval = setInterval(() => {
        void loadNotifications();
        void loadUnreadCount();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [actualToken]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // Vérifier que le token existe
    if (!actualToken || actualToken.trim() === "") {
      setError("Erreur d'authentification : veuillez vous reconnecter");
      setLoading(false);
      return;
    }
    
    try {
      const requestBody = {
        title: title.trim(),
        description: description.trim(),
        priority: priority.toLowerCase(),
        type: type.toLowerCase(),
      };
      
      console.log("Envoi de la requête de création de ticket...", requestBody);
      console.log("Token utilisé:", actualToken.substring(0, 20) + "...");
      
      const res = await fetch("http://localhost:8000/tickets/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actualToken}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Réponse reçue:", res.status, res.statusText);
      
      if (!res.ok) {
        let errorMessage = `Erreur ${res.status}: ${res.statusText}`;
        try {
          const errorData = await res.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          // Si on ne peut pas parser le JSON, utiliser le message par défaut
        }
        throw new Error(errorMessage);
      }
      
      // Succès
      const newTicket = await res.json();
      console.log("Ticket créé avec succès:", newTicket);
      setTitle("");
      setDescription("");
      setPriority("moyenne");
      setType("materiel");
      await loadTickets();
      await loadNotifications();
      await loadUnreadCount();
      alert("Ticket créé avec succès !");
    } catch (err: any) {
      const errorMsg = err.message || "Erreur lors de la création du ticket";
      setError(errorMsg);
      console.error("Erreur création ticket:", err);
      
      // Message plus spécifique pour "Failed to fetch"
      if (errorMsg.includes("Failed to fetch") || errorMsg.includes("NetworkError")) {
        setError("Impossible de contacter le serveur. Vérifiez que le backend est démarré sur http://localhost:8000");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleValidateTicket(ticketId: string, validated: boolean) {
    // Si rejet, vérifier que le motif est fourni
    if (!validated && (!rejectionReason || !rejectionReason.trim())) {
      alert("Veuillez indiquer un motif de rejet");
      return;
    }

    setLoading(true);
    try {
      const requestBody: { validated: boolean; rejection_reason?: string } = { validated };
      if (!validated && rejectionReason) {
        requestBody.rejection_reason = rejectionReason.trim();
      }

      const res = await fetch(`http://localhost:8000/tickets/${ticketId}/validate`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actualToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        await loadTickets();
        await loadNotifications();
        await loadUnreadCount();
        setValidationTicket(null);
        setRejectionReason("");
        setShowRejectionForm(false);
        alert(validated ? "Ticket validé et clôturé avec succès !" : "Ticket rejeté. Le technicien a été notifié avec le motif.");
      } else {
        const error = await res.json();
        alert(`Erreur: ${error.detail || "Impossible de valider le ticket"}`);
      }
    } catch (err) {
      console.error("Erreur validation:", err);
      alert("Erreur lors de la validation");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitFeedback(ticketId: string) {
    if (feedbackScore < 1 || feedbackScore > 5) {
      alert("Veuillez sélectionner un score entre 1 et 5");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/tickets/${ticketId}/feedback`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${actualToken}`,
        },
        body: JSON.stringify({
          score: feedbackScore,
          comment: feedbackComment,
        }),
      });

      if (res.ok) {
        await loadTickets();
        await loadNotifications();
        await loadUnreadCount();
        setFeedbackTicket(null);
        setFeedbackScore(5);
        setFeedbackComment("");
        alert("Merci pour votre avis !");
      } else {
        const error = await res.json();
        alert(`Erreur: ${error.detail || "Impossible d'envoyer le feedback"}`);
      }
    } catch (err) {
      console.error("Erreur feedback:", err);
      alert("Erreur lors de l'envoi du feedback");
    } finally {
      setLoading(false);
    }
  }

  const opened = tickets.filter((t) => t.status !== "cloture" && t.status !== "resolu" && t.status !== "rejete").length;
  const inProgress = tickets.filter((t) => t.status === "en_cours" || t.status === "assigne_technicien").length;
  const resolved = tickets.filter((t) => t.status === "resolu" || t.status === "cloture").length;

  function formatDate(dateString: string | null | undefined): string {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return "Aujourd'hui";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Hier";
    } else {
      return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }
  }

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("dashboard");
  const ticketsListRef = useRef<HTMLDivElement>(null);
  const [userInfo, setUserInfo] = useState<{ full_name: string } | null>(null);

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif", background: "#f5f5f5" }}>
      {/* Sidebar */}
      <div style={{ 
        width: "250px", 
        background: "#1e293b", 
        color: "white", 
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
        {/* User Profile Section */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px", paddingBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            background: "#9ca3af",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: "20px",
            fontWeight: "600",
            marginBottom: "12px"
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="7" r="4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: "16px", fontWeight: "600", color: "white", marginBottom: "4px" }}>
            {userInfo?.full_name || "Jean Dupont"}
          </div>
          <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)" }}>
            Utilisateur
        </div>
        </div>

        <div 
          onClick={() => setActiveSection("dashboard")}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            padding: "12px", 
            cursor: "pointer",
            background: activeSection === "dashboard" ? "rgba(59, 130, 246, 0.2)" : "transparent",
            borderRadius: "8px"
          }}
        >
          <div style={{ 
            width: "20px", 
            height: "20px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" fill="none" />
              <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="1" fill="white" />
            </svg>
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "white"
          }}>Tableau de bord</div>
        </div>
        <div 
          onClick={() => setShowCreateModal(true)}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            padding: "12px", 
            cursor: "pointer"
          }}
        >
          <div style={{ 
            width: "20px", 
            height: "20px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "white"
          }}>Nouveau ticket</div>
        </div>
        <div 
          onClick={() => {
            setActiveSection("tickets");
            setTimeout(() => {
              ticketsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 100);
          }}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            padding: "12px", 
            cursor: "pointer"
          }}
        >
          <div style={{ 
            width: "20px", 
            height: "20px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 7h8M8 11h8M8 15h6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "white"
          }}>Mes tickets</div>
        </div>
        <div 
          onClick={() => {}}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            padding: "12px", 
            cursor: "pointer"
          }}
        >
          <div style={{ 
            width: "20px", 
            height: "20px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M9 9h.01M13 9h.01" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="12" r="1" fill="white" />
            </svg>
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "white"
          }}>FAQ & Aide</div>
        </div>
        <div 
          onClick={handleLogout}
          style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "12px", 
            padding: "12px", 
            cursor: "pointer"
          }}
        >
          <div style={{ 
            width: "20px", 
            height: "20px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center"
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="16 17 21 12 16 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="21" y1="12" x2="9" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ 
            fontSize: "14px", 
            color: "white"
          }}>Déconnexion</div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Barre de navigation en haut */}
        <div style={{
          background: "#1e293b",
          padding: "16px 30px",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "24px",
          borderBottom: "1px solid rgba(59, 130, 246, 0.2)"
        }}>
          <div style={{ 
            cursor: "pointer", 
            width: "28px", 
            height: "28px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            color: "white",
            borderRadius: "6px",
            transition: "all 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              {/* Bulle de conversation arrière (décalée en haut à gauche) */}
              <rect x="2" y="3" width="10" height="8" rx="1.5" opacity="0.7" />
              <polygon points="10,11 8.5,12.5 10,12.5" opacity="0.7" />
              {/* Bulle de conversation principale */}
              <rect x="4" y="5" width="10" height="8" rx="1.5" />
              <polygon points="12,13 10.5,14.5 12,14.5" />
            </svg>
          </div>
          <div 
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ 
              cursor: "pointer", 
              width: "28px", 
              height: "28px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: "white",
              position: "relative",
              borderRadius: "6px",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              {/* Boucle circulaire en haut */}
              <circle cx="12" cy="4.5" r="1" />
              {/* Corps de la cloche (base large arrondie, sommet étroit arrondi) */}
              <path d="M6 7.5a6 6 0 0 1 12 0c0 6.5 2.5 8.5 2.5 8.5H3.5s2.5-2 2.5-8.5z" />
            </svg>
            {/* Badge de notification */}
            {unreadCount > 0 && (
              <span style={{
                position: "absolute",
                top: "-5px",
                right: "-5px",
                minWidth: "18px",
                height: "18px",
                background: "#ef4444",
                borderRadius: "50%",
                border: "2px solid #374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "11px",
                fontWeight: "bold",
                color: "white",
                padding: "0 4px"
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Contenu principal avec scroll */}
        <div style={{ flex: 1, padding: "30px", overflow: "auto" }}>
          {/* Message de bienvenue - Visible seulement sur Dashboard */}
          {activeSection === "dashboard" && userInfo && (
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontSize: "28px", fontWeight: "600", color: "#333", margin: 0 }}>
                Bienvenue, {userInfo.full_name} 👋
              </h2>
            </div>
          )}
        
        {/* Summary Cards - Visible seulement sur Dashboard */}
        {activeSection === "dashboard" && (
          <div style={{ display: "flex", gap: "20px", marginBottom: "30px" }}>
            <div style={{ 
              padding: "24px", 
              background: "white", 
              borderRadius: "8px", 
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)", 
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#ff9800", lineHeight: "1", marginBottom: "8px" }}>
                {opened}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>Tickets Ouverts</div>
            </div>
            <div style={{ 
              padding: "24px", 
              background: "white", 
              borderRadius: "8px", 
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)", 
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#007bff", lineHeight: "1", marginBottom: "8px" }}>
                {inProgress}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>Tickets en cours</div>
            </div>
            <div style={{ 
              padding: "24px", 
              background: "white", 
              borderRadius: "8px", 
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)", 
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start"
            }}>
              <div style={{ fontSize: "32px", fontWeight: "bold", color: "#28a745", lineHeight: "1", marginBottom: "8px" }}>
                {resolved}
              </div>
              <div style={{ fontSize: "14px", color: "#666" }}>Tickets Résolus</div>
            </div>
          </div>
        )}

        {/* Section Header with Create Button */}
        {(activeSection === "tickets" || activeSection === "dashboard") && (
          <div ref={ticketsListRef}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#333" }}>
                {activeSection === "dashboard" ? "Mes Tickets Récents" : "Mes Tickets"}
              </h3>
              <div
                onClick={() => setShowCreateModal(true)}
                style={{
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#333",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <span style={{ fontSize: "18px", fontWeight: "600" }}>+</span>
                <span>Créer un nouveau Ticket</span>
              </div>
            </div>
            {/* Tickets Table */}
            <div style={{ background: "white", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#9ca3af", borderBottom: "1px solid #6b7280" }}>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>ID</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>Titre</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>Statut</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>Priorité</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
                <th style={{ padding: "16px", textAlign: "left", fontSize: "13px", fontWeight: "700", color: "#333", textTransform: "uppercase", letterSpacing: "0.5px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#999", fontWeight: "500" }}>
                    Aucun ticket créé
                  </td>
                </tr>
              ) : (
                [...tickets]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .slice(0, activeSection === "dashboard" ? 5 : tickets.length)
                  .map((t) => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #eee", cursor: "pointer" }}>
                    <td style={{ padding: "16px", color: "#333", fontSize: "14px" }}>#{t.number}</td>
                    <td style={{ padding: "16px", color: "#333", fontSize: "14px" }}>{t.title}</td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "500",
                        background: t.status === "en_attente_analyse" ? "#ffc107" : t.status === "assigne_technicien" ? "#007bff" : t.status === "en_cours" ? "#ff9800" : t.status === "resolu" ? "#28a745" : t.status === "cloture" ? "#6c757d" : "#dc3545",
                        color: "white",
                        whiteSpace: "nowrap",
                        display: "inline-block"
                      }}>
                        {t.status === "en_attente_analyse" ? "En attente d'analyse" :
                         t.status === "assigne_technicien" ? "Assigné au technicien" :
                         t.status === "en_cours" ? "En cours" :
                         t.status === "resolu" ? "Résolu" :
                         t.status === "rejete" ? "Rejeté" :
                         t.status === "cloture" ? "Clôturé" : t.status}
                      </span>
                    </td>
                    <td style={{ padding: "16px" }}>
                      <span style={{
                        padding: "6px 12px",
                        borderRadius: "20px",
                        fontSize: "12px",
                        fontWeight: "500",
                        background: t.priority === "critique" ? "#dc3545" : t.priority === "haute" ? "#ffc107" : t.priority === "moyenne" ? "#007bff" : "#6c757d",
                        color: "white"
                      }}>
                        {t.priority}
                      </span>
                    </td>
                    <td style={{ padding: "16px", fontSize: "14px", color: "#333" }}>
                      {formatDate(t.assigned_at || t.created_at)}
                    </td>
                    <td style={{ padding: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {t.status === "resolu" ? (
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setValidationTicket(t.id);
                                setShowRejectionForm(false);
                                setRejectionReason("");
                              }}
                              disabled={loading}
                              style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            >
                              Valider
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setValidationTicket(t.id);
                                setShowRejectionForm(true);
                                setRejectionReason("");
                              }}
                              disabled={loading}
                              style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                            >
                              Rejeter
                            </button>
                          </div>
                        ) : t.status === "cloture" && !t.feedback_score ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setFeedbackTicket(t.id); }}
                            disabled={loading}
                            style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Donner mon avis
                          </button>
                        ) : t.status === "cloture" && t.feedback_score ? (
                          <span style={{ color: "#28a745", fontSize: "12px" }}>
                            ✓ Avis donné ({t.feedback_score}/5)
                          </span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
          </div>
        )}

        {/* Create Ticket Modal */}
        {showCreateModal && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000
          }}>
            <div style={{
              background: "white",
              padding: "32px",
              borderRadius: "12px",
              maxWidth: "600px",
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <h3 style={{ fontSize: "24px", fontWeight: "700", color: "#333" }}>Créer un nouveau ticket</h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setError(null);
                    setTitle("");
                    setDescription("");
                    setPriority("moyenne");
                    setType("materiel");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#999"
                  }}
                >
                  ×
                </button>
              </div>
              {error && (
                <div style={{
                  padding: "12px",
                  marginBottom: "16px",
                  background: "#ffebee",
                  color: "#c62828",
                  borderRadius: "4px",
                  border: "1px solid #ef5350"
                }}>
                  <strong>Erreur :</strong> {error}
                </div>
              )}
              <form onSubmit={(e) => {
                handleCreate(e);
                if (!error) {
                  setShowCreateModal(false);
                }
              }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Titre</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={loading}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}
          />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            disabled={loading}
            rows={4}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px", resize: "vertical" }}
          />
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}
          >
            <option value="materiel">Matériel</option>
            <option value="applicatif">Applicatif</option>
          </select>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>Priorité</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            style={{ width: "100%", padding: "10px", border: "1px solid #ddd", borderRadius: "4px" }}
          >
            <option value="faible">Faible</option>
            <option value="moyenne">Moyenne</option>
            <option value="haute">Haute</option>
            <option value="critique">Critique</option>
          </select>
        </div>
                <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
                  <button type="submit" disabled={loading || !title.trim() || !description.trim()} style={{
                    flex: 1,
                    padding: "12px 24px",
                    backgroundColor: "#28a745",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    {loading ? "Création en cours..." : "Soumettre le ticket"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setError(null);
                      setTitle("");
                      setDescription("");
                      setPriority("moyenne");
                      setType("materiel");
                    }}
                    style={{
                      padding: "12px 24px",
                      background: "#f5f5f5",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      cursor: "pointer",
                      fontSize: "14px",
                      fontWeight: "600"
                    }}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de validation */}
        {validationTicket && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000
                }}>
                  <div style={{
                    background: "white",
                    padding: "24px",
                    borderRadius: "8px",
                    maxWidth: "500px",
                    width: "90%"
                  }}>
                    {!showRejectionForm ? (
                      <>
                    <h3 style={{ marginBottom: "16px" }}>Valider la résolution</h3>
                    <p style={{ marginBottom: "16px", color: "#666" }}>
                      Le problème a-t-il été résolu de manière satisfaisante ?
                    </p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                      <button
                        onClick={() => handleValidateTicket(validationTicket, true)}
                        disabled={loading}
                        style={{ flex: 1, padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Oui, valider
                      </button>
                      <button
                            onClick={() => {
                              setShowRejectionForm(true);
                              setRejectionReason("");
                            }}
                        disabled={loading}
                        style={{ flex: 1, padding: "10px", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Non, rejeter
                      </button>
                      <button
                            onClick={() => {
                              setValidationTicket(null);
                              setShowRejectionForm(false);
                              setRejectionReason("");
                            }}
                        style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Annuler
                      </button>
                    </div>
                      </>
                    ) : (
                      <>
                        <h3 style={{ marginBottom: "16px", color: "#dc3545" }}>Rejeter la résolution</h3>
                        <p style={{ marginBottom: "16px", color: "#666" }}>
                          Veuillez indiquer le motif de rejet. Cette information sera transmise au technicien pour l'aider à mieux résoudre votre problème.
                        </p>
                        <div style={{ marginBottom: "16px" }}>
                          <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", color: "#333" }}>
                            Motif de rejet <span style={{ color: "#dc3545" }}>*</span>
                          </label>
                          <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Exemple: Le problème persiste toujours, la solution proposée ne fonctionne pas, j'ai besoin de plus d'informations..."
                            rows={4}
                            required
                            style={{
                              width: "100%",
                              padding: "10px",
                              border: "1px solid #ddd",
                              borderRadius: "4px",
                              fontSize: "14px",
                              resize: "vertical",
                              fontFamily: "inherit"
                            }}
                          />
                  </div>
                        <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                          <button
                            onClick={() => handleValidateTicket(validationTicket, false)}
                            disabled={loading || !rejectionReason.trim()}
                            style={{ 
                              flex: 1, 
                              padding: "10px", 
                              backgroundColor: rejectionReason.trim() ? "#dc3545" : "#ccc", 
                              color: "white", 
                              border: "none", 
                              borderRadius: "4px", 
                              cursor: rejectionReason.trim() ? "pointer" : "not-allowed" 
                            }}
                          >
                            Confirmer le rejet
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectionForm(false);
                              setRejectionReason("");
                            }}
                            disabled={loading}
                            style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Retour
                          </button>
                          <button
                            onClick={() => {
                              setValidationTicket(null);
                              setShowRejectionForm(false);
                              setRejectionReason("");
                            }}
                            style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
                          >
                            Annuler
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
        )}

        {/* Modal de feedback */}
        {feedbackTicket && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000
                }}>
                  <div style={{
                    background: "white",
                    padding: "24px",
                    borderRadius: "8px",
                    maxWidth: "500px",
                    width: "90%"
                  }}>
                    <h3 style={{ marginBottom: "16px" }}>Formulaire de satisfaction</h3>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                        Notez votre satisfaction (1-5) :
                      </label>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            onClick={() => setFeedbackScore(score)}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              border: "2px solid",
                              borderColor: feedbackScore === score ? "#007bff" : "#ddd",
                              background: feedbackScore === score ? "#007bff" : "white",
                              color: feedbackScore === score ? "white" : "#333",
                              cursor: "pointer",
                              fontSize: "18px",
                              fontWeight: "bold"
                            }}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                        Commentaire (optionnel) :
                      </label>
                      <textarea
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        placeholder="Votre avis..."
                        rows={4}
                        style={{
                          width: "100%",
                          padding: "8px",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          resize: "vertical"
                        }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                      <button
                        onClick={() => handleSubmitFeedback(feedbackTicket)}
                        disabled={loading || feedbackScore < 1 || feedbackScore > 5}
                        style={{ flex: 1, padding: "10px", backgroundColor: "#17a2b8", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Envoyer
                      </button>
                      <button
                        onClick={() => {
                          setFeedbackTicket(null);
                          setFeedbackScore(5);
                          setFeedbackComment("");
                        }}
                        style={{ flex: 1, padding: "10px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", cursor: "pointer" }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              )}

        {/* Modal de notifications */}
        {showNotifications && (
          <div 
            onClick={() => setShowNotifications(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "flex-end",
              padding: "60px 20px 20px 20px",
              zIndex: 1000
            }}
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: "12px",
                width: "400px",
                maxHeight: "600px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden"
              }}
            >
              <div style={{
                padding: "20px",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#333" }}>
                  Notifications
                </h3>
                <button
                  onClick={() => setShowNotifications(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#999",
                    padding: "0",
                    width: "24px",
                    height: "24px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  ×
                </button>
              </div>
              <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "10px"
              }}>
                {notifications.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "40px 20px",
                    color: "#999"
                  }}>
                    Aucune notification
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (!notif.read) {
                          void markNotificationAsRead(notif.id);
                        }
                      }}
                      style={{
                        padding: "12px",
                        marginBottom: "8px",
                        borderRadius: "8px",
                        background: notif.read ? "#f9f9f9" : "#e3f2fd",
                        border: notif.read ? "1px solid #eee" : "1px solid #90caf9",
                        cursor: "pointer",
                        transition: "background 0.2s"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "10px"
                      }}>
                        <div style={{ flex: 1 }}>
                          <p style={{
                            margin: 0,
                            fontSize: "14px",
                            color: "#333",
                            lineHeight: "1.5"
                          }}>
                            {notif.message}
                          </p>
                          <p style={{
                            margin: "4px 0 0 0",
                            fontSize: "11px",
                            color: "#999"
                          }}>
                            {new Date(notif.created_at).toLocaleString("fr-FR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                        {!notif.read && (
                          <div style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "#007bff",
                            flexShrink: 0,
                            marginTop: "4px"
                          }}></div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;


