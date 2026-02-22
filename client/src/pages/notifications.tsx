import Layout from "@/components/layout";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BellRing, CheckCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

export default function NotificationsPage() {
  const { toast } = useToast();

  const {
    data: notifications = [],
    isLoading,
    isError,
  } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) throw new Error("Falha ao carregar notificacoes");
      return res.json();
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast({ title: "Notificacoes atualizadas", description: "Todas marcadas como lidas." });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar notificacoes",
        description: "Nao foi possivel marcar todas como lidas.",
        variant: "destructive",
      });
    },
  });

  const markOneAsRead = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Notificacoes
            </h1>
            <p className="text-muted-foreground">
              Acompanhe alertas fiscais, contas a pagar e contas a receber.
            </p>
          </div>
          <Button
            onClick={() => markAllAsRead.mutate()}
            disabled={markAllAsRead.isPending || unreadCount === 0}
            data-testid="button-mark-all-read"
          >
            {markAllAsRead.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Marcar todas como lidas
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Central de notificacoes
            </CardTitle>
            <CardDescription>
              Total: {notifications.length} | Nao lidas: {unreadCount}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Falha ao carregar notificacoes.
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nenhuma notificacao no momento.
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`rounded-md border p-4 ${
                      notification.isRead ? "bg-background" : "bg-muted/30"
                    }`}
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.message}</p>
                      </div>
                      {!notification.isRead && (
                        <Badge variant="secondary" className="shrink-0">
                          Nova
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatDate(notification.createdAt)}
                      </span>
                      {!notification.isRead && notification.id > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => markOneAsRead.mutate(notification.id)}
                          disabled={markOneAsRead.isPending}
                          data-testid={`button-mark-read-${notification.id}`}
                        >
                          Marcar como lida
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

